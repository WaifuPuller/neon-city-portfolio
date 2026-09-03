import { colliders, WORLD_BOUNDS } from './world';
import { PLAYER_RADIUS } from './collision';

/* ---------------------------------------------------------------------------
 * Street-level route finding.
 *
 * The city is baked once into a coarse walkable/blocked grid, then routes are
 * found with A* over it and straightened afterwards. That gives a path that
 * follows the streets and never cuts through a tower, which is the whole point
 * of the on-ground navigation arrows.
 *
 * The grid is small (a couple of thousand cells) and built a single time at
 * module load, so a full route costs well under a millisecond and can safely
 * be recomputed while the player walks.
 * ------------------------------------------------------------------------- */

/** World units per cell. Small enough to fit through the alleys, big enough to stay cheap. */
const CELL = 1.5;

/**
 * How far to fatten every building before marking cells blocked.
 *
 * The player is a circle, so the route has to keep its CENTRE at least a
 * radius away from any wall. The extra margin on top covers the fact that
 * cells are tested at their centre point: without it a route could clip a
 * corner that the collision system would then refuse to let the player
 * through, and the arrows would be pointing at a wall.
 */
const CLEARANCE = PLAYER_RADIUS + 0.8;

const COLS = Math.ceil((WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / CELL);
const ROWS = Math.ceil((WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) / CELL);

const blocked = new Uint8Array(COLS * ROWS);

const cellCentreX = (col: number) => WORLD_BOUNDS.minX + (col + 0.5) * CELL;
const cellCentreZ = (row: number) => WORLD_BOUNDS.minZ + (row + 0.5) * CELL;

const colOf = (x: number) =>
  Math.min(COLS - 1, Math.max(0, Math.floor((x - WORLD_BOUNDS.minX) / CELL)));
const rowOf = (z: number) =>
  Math.min(ROWS - 1, Math.max(0, Math.floor((z - WORLD_BOUNDS.minZ) / CELL)));

/* Bake the grid. Each building is stamped in as a fattened rectangle. */
for (const c of colliders) {
  const minCol = colOf(c.x - c.hw - CLEARANCE);
  const maxCol = colOf(c.x + c.hw + CLEARANCE);
  const minRow = rowOf(c.z - c.hd - CLEARANCE);
  const maxRow = rowOf(c.z + c.hd + CLEARANCE);

  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      const px = cellCentreX(col);
      const pz = cellCentreZ(row);
      if (
        px >= c.x - c.hw - CLEARANCE &&
        px <= c.x + c.hw + CLEARANCE &&
        pz >= c.z - c.hd - CLEARANCE &&
        pz <= c.z + c.hd + CLEARANCE
      ) {
        blocked[row * COLS + col] = 1;
      }
    }
  }
}

const isFree = (col: number, row: number) =>
  col >= 0 && col < COLS && row >= 0 && row < ROWS && blocked[row * COLS + col] === 0;

/* ------------------------------------------------------------- binary heap */

/**
 * A plain array with a linear scan for the minimum would make A* quadratic in
 * the number of expanded nodes, which is exactly the sort of thing that turns
 * into a visible stutter on a phone. This keeps it n log n.
 */
class MinHeap {
  private items: number[] = [];
  private costs: number[] = [];

  get size() {
    return this.items.length;
  }

  push(item: number, cost: number) {
    this.items.push(item);
    this.costs.push(cost);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.costs[parent] <= this.costs[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastCost = this.costs.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.costs[0] = lastCost;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let best = i;
        if (l < this.items.length && this.costs[l] < this.costs[best]) best = l;
        if (r < this.items.length && this.costs[r] < this.costs[best]) best = r;
        if (best === i) break;
        this.swap(best, i);
        i = best;
      }
    }
    return top;
  }

  private swap(a: number, b: number) {
    const ti = this.items[a];
    this.items[a] = this.items[b];
    this.items[b] = ti;
    const tc = this.costs[a];
    this.costs[a] = this.costs[b];
    this.costs[b] = tc;
  }
}

/* ------------------------------------------------------- nearest free cell */

/**
 * Snap a point onto walkable ground.
 *
 * Needed at both ends: the destination is the centre of a landmark, which may
 * itself be solid, and the player can be standing on a rooftop or wedged in a
 * corner. Spiralling outwards finds the closest legal stand-in.
 */
function nearestFree(col: number, row: number): [number, number] | null {
  if (isFree(col, row)) return [col, row];

  for (let ring = 1; ring <= 24; ring++) {
    for (let d = -ring; d <= ring; d++) {
      const candidates: [number, number][] = [
        [col + d, row - ring],
        [col + d, row + ring],
        [col - ring, row + d],
        [col + ring, row + d],
      ];
      for (const [c, r] of candidates) {
        if (isFree(c, r)) return [c, r];
      }
    }
  }
  return null;
}

/* --------------------------------------------------------- line of sight */

/**
 * The buildings again, but as the fattened rectangles a route has to stay out
 * of. Precomputed because the smoothing pass hits them thousands of times.
 */
const padded = colliders.map((c) => ({
  minX: c.x - c.hw - CLEARANCE,
  maxX: c.x + c.hw + CLEARANCE,
  minZ: c.z - c.hd - CLEARANCE,
  maxZ: c.z + c.hd + CLEARANCE,
}));

const inBounds = (x: number, z: number) =>
  x >= WORLD_BOUNDS.minX && x <= WORLD_BOUNDS.maxX &&
  z >= WORLD_BOUNDS.minZ && z <= WORLD_BOUNDS.maxZ;

/**
 * True when a straight line between two world points stays walkable.
 *
 * This tests the building rectangles EXACTLY (slab method) rather than
 * sampling the grid along the way. Sampling every half-cell looked fine but
 * stepped straight over shallow corner clips, so the smoothed path would
 * occasionally shave the edge of a tower and the arrows would visibly walk
 * through a wall.
 */
function clearLine(ax: number, az: number, bx: number, bz: number): boolean {
  // Both ends inside the box means the whole segment is: the map is convex.
  if (!inBounds(ax, az) || !inBounds(bx, bz)) return false;

  const dx = bx - ax;
  const dz = bz - az;

  for (const r of padded) {
    let tmin = 0;
    let tmax = 1;

    if (Math.abs(dx) < 1e-9) {
      if (ax < r.minX || ax > r.maxX) continue; // parallel and outside this slab
    } else {
      let t1 = (r.minX - ax) / dx;
      let t2 = (r.maxX - ax) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }

    if (Math.abs(dz) < 1e-9) {
      if (az < r.minZ || az > r.maxZ) continue;
    } else {
      let t1 = (r.minZ - az) / dz;
      let t2 = (r.maxZ - az) / dz;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }

    return false; // the segment enters this building's clearance zone
  }

  return true;
}

/* ------------------------------------------------------------------- A* */

export type Waypoint = [number, number];

export interface Route {
  /** World-space corners, from the player to the destination. */
  points: Waypoint[];
  /** Total walking distance in world units. */
  distance: number;
}

const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Overweighting the heuristic makes A* commit to the direction of the goal
 * instead of fanning out evenly, which cuts the worst corner-to-corner search
 * to a fraction of its cost. The trade is that the route can come out slightly
 * longer than the true optimum — a couple of percent over the whole city,
 * which nobody following a line of arrows will ever notice, in exchange for
 * not dropping a frame on a phone every time the route is replanned.
 */
const HEURISTIC_WEIGHT = 1.25;

/** Scratch buffers, reused between calls so routing allocates nothing. */
const gScore = new Float32Array(COLS * ROWS);
const cameFrom = new Int32Array(COLS * ROWS);
const closed = new Uint8Array(COLS * ROWS);
let stamp = 0;
const visitStamp = new Int32Array(COLS * ROWS);

/**
 * Shortest walkable route between two world points, or null if there is no
 * way through. The result is already straightened, so consecutive points are
 * usually many metres apart and can be drawn as long straight runs.
 */
export function findRoute(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
): Route | null {
  const start = nearestFree(colOf(startX), rowOf(startZ));
  const goal = nearestFree(colOf(goalX), rowOf(goalZ));
  if (!start || !goal) return null;

  const startIdx = start[1] * COLS + start[0];
  const goalIdx = goal[1] * COLS + goal[0];

  stamp += 1;
  const open = new MinHeap();

  gScore[startIdx] = 0;
  cameFrom[startIdx] = -1;
  visitStamp[startIdx] = stamp;
  closed[startIdx] = 0;

  const heuristic = (col: number, row: number) => {
    // Octile distance: the exact cost of 8-way movement over open ground.
    const dx = Math.abs(col - goal[0]);
    const dy = Math.abs(row - goal[1]);
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * HEURISTIC_WEIGHT;
  };

  open.push(startIdx, heuristic(start[0], start[1]));

  let found = false;
  while (open.size > 0) {
    const currentIdx = open.pop();
    if (closed[currentIdx] === 1 && visitStamp[currentIdx] === stamp) continue;
    closed[currentIdx] = 1;
    visitStamp[currentIdx] = stamp;

    if (currentIdx === goalIdx) {
      found = true;
      break;
    }

    const col = currentIdx % COLS;
    const row = (currentIdx - col) / COLS;

    for (const [dc, dr, cost] of NEIGHBOURS) {
      const nc = col + dc;
      const nr = row + dr;
      if (!isFree(nc, nr)) continue;

      // Refuse to squeeze diagonally between two touching corners; the
      // collision system would stop the player dead there.
      if (dc !== 0 && dr !== 0 && (!isFree(col + dc, row) || !isFree(col, row + dr))) continue;

      const nIdx = nr * COLS + nc;
      if (visitStamp[nIdx] === stamp && closed[nIdx] === 1) continue;

      const tentative = gScore[currentIdx] + cost;
      const seen = visitStamp[nIdx] === stamp;
      if (seen && tentative >= gScore[nIdx]) continue;

      gScore[nIdx] = tentative;
      cameFrom[nIdx] = currentIdx;
      visitStamp[nIdx] = stamp;
      closed[nIdx] = 0;
      open.push(nIdx, tentative + heuristic(nc, nr));
    }
  }

  if (!found) return null;

  /* --------------------------------------------------- rebuild and smooth */

  const cells: Waypoint[] = [];
  for (let idx = goalIdx; idx !== -1; idx = cameFrom[idx]) {
    const col = idx % COLS;
    const row = (idx - col) / COLS;
    cells.push([cellCentreX(col), cellCentreZ(row)]);
    if (idx === startIdx) break;
  }
  cells.reverse();

  /* Anchor the ends on the real positions rather than cell centres, but only
     where that is actually walkable. The player can be somewhere the grid
     calls solid — on a rooftop, or wedged in a corner — and the destination
     may be outside the map altogether, in which case snapping to the nearest
     legal cell is the honest answer instead of drawing a line off the edge. */
  if (clearLine(startX, startZ, cells[0][0], cells[0][1])) cells[0] = [startX, startZ];
  const last = cells[cells.length - 1];
  if (clearLine(last[0], last[1], goalX, goalZ)) cells.push([goalX, goalZ]);

  /* String-pulling: walk forward keeping only the corners you actually have to
     turn at. Done incrementally rather than by scanning back from the end for
     the furthest visible cell, which was quadratic in the path length. */
  const points: Waypoint[] = [cells[0]];
  let anchor = 0;
  for (let i = 1; i < cells.length - 1; i++) {
    const [ax, az] = cells[anchor];
    const [nx, nz] = cells[i + 1];
    if (!clearLine(ax, az, nx, nz)) {
      points.push(cells[i]);
      anchor = i;
    }
  }
  if (cells.length > 1) points.push(cells[cells.length - 1]);

  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }

  return { points, distance };
}

/** Evenly spaced points along a route, for laying out the ground arrows. */
export function sampleRoute(route: Route, spacing: number, max: number) {
  const out: { x: number; z: number; dirX: number; dirZ: number; travelled: number }[] = [];

  // Distance along the whole polyline at which the next arrow goes, so the
  // spacing stays even straight through corners.
  let next = spacing * 0.5;
  let travelled = 0;

  for (let i = 1; i < route.points.length && out.length < max; i++) {
    const [ax, az] = route.points[i - 1];
    const [bx, bz] = route.points[i];
    const segLength = Math.hypot(bx - ax, bz - az);
    if (segLength < 1e-4) continue;

    const dirX = (bx - ax) / segLength;
    const dirZ = (bz - az) / segLength;

    while (next <= travelled + segLength && out.length < max) {
      const d = next - travelled;
      out.push({ x: ax + dirX * d, z: az + dirZ * d, dirX, dirZ, travelled: next });
      next += spacing;
    }

    travelled += segLength;
  }

  return out;
}

/* Dev-only sanity check: a city where nothing can reach anything would be a
   silent disaster, so say so loudly while developing. */
if (import.meta.env.DEV) {
  const free = blocked.reduce((n, b) => n + (b === 0 ? 1 : 0), 0);
  if (free / blocked.length < 0.25) {
    console.warn(
      `[portfolio] navigation grid is ${Math.round((1 - free / blocked.length) * 100)}% blocked; ` +
        'routes may fail. Check CLEARANCE in systems/navigation.ts.',
    );
  }
}
