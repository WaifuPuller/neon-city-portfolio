import { Collider } from '../types/game';
import { colliders, WORLD_BOUNDS } from './world';

/* ---------------------------------------------------------------------------
 * Swept circle-vs-AABB collision on the XZ plane.
 *
 * The player is treated as a circle of PLAYER_RADIUS. Each axis is resolved
 * independently (move X, push out; move Z, push out) which gives the smooth
 * "slide along the wall" feel you expect in a third-person game rather than
 * sticking on corners.
 *
 * Colliders are bucketed into a uniform grid so we only test the handful of
 * buildings near the player instead of all ~70 every frame.
 * ------------------------------------------------------------------------- */

export const PLAYER_RADIUS = 0.55;
/** Anything this short can be walked onto rather than blocking movement. */
export const STEP_HEIGHT = 0.6;

const CELL = 16;
const grid = new Map<string, Collider[]>();

const key = (cx: number, cz: number) => `${cx}|${cz}`;

for (const c of colliders) {
  const minCx = Math.floor((c.x - c.hw) / CELL);
  const maxCx = Math.floor((c.x + c.hw) / CELL);
  const minCz = Math.floor((c.z - c.hd) / CELL);
  const maxCz = Math.floor((c.z + c.hd) / CELL);
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const k = key(cx, cz);
      const bucket = grid.get(k);
      if (bucket) bucket.push(c);
      else grid.set(k, [c]);
    }
  }
}

function nearby(x: number, z: number): Collider[] {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  const out: Collider[] = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const bucket = grid.get(key(cx + i, cz + j));
      if (bucket) out.push(...bucket);
    }
  }
  return out;
}

/** True when a circle at (x, z) overlaps the given box. */
function overlaps(x: number, z: number, c: Collider, r: number) {
  const dx = Math.abs(x - c.x) - c.hw;
  const dz = Math.abs(z - c.z) - c.hd;
  if (dx > r || dz > r) return false;
  if (dx <= 0 || dz <= 0) return true;
  return dx * dx + dz * dz <= r * r;
}

/** Push a circle out of a box along the shallowest axis of penetration. */
function resolve(x: number, z: number, c: Collider, r: number): [number, number] {
  const dx = x - c.x;
  const dz = z - c.z;
  const overlapX = c.hw + r - Math.abs(dx);
  const overlapZ = c.hd + r - Math.abs(dz);
  if (overlapX < overlapZ) {
    return [c.x + Math.sign(dx || 1) * (c.hw + r), z];
  }
  return [x, c.z + Math.sign(dz || 1) * (c.hd + r)];
}

export interface MoveResult {
  x: number;
  z: number;
  /** Height of whatever surface is directly under the player. */
  groundY: number;
  /** True if the move was blocked on at least one axis (used for footstep FX). */
  hit: boolean;
}

/**
 * Move a player from (x, z) by (dx, dz), resolving collisions.
 * `feetY` is the player's current foot height, used to decide whether a
 * building is a wall or a surface they are already standing on top of.
 */
export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  feetY: number,
): MoveResult {
  let nx = x + dx;
  let nz = z + dz;
  let hit = false;

  const candidates = nearby(nx, nz);

  // Resolve X first, then Z, so the player slides along surfaces.
  for (const c of candidates) {
    // Already above it, so it is floor, not wall.
    if (feetY >= c.top - STEP_HEIGHT) continue;
    if (overlaps(nx, z, c, PLAYER_RADIUS)) {
      [nx] = resolve(nx, z, c, PLAYER_RADIUS);
      hit = true;
    }
  }
  for (const c of candidates) {
    if (feetY >= c.top - STEP_HEIGHT) continue;
    if (overlaps(nx, nz, c, PLAYER_RADIUS)) {
      [, nz] = resolve(nx, nz, c, PLAYER_RADIUS);
      hit = true;
    }
  }

  // Keep the player inside the map.
  nx = Math.min(WORLD_BOUNDS.maxX, Math.max(WORLD_BOUNDS.minX, nx));
  nz = Math.min(WORLD_BOUNDS.maxZ, Math.max(WORLD_BOUNDS.minZ, nz));

  return { x: nx, z: nz, groundY: groundHeightAt(nx, nz), hit };
}

/** Height of the highest surface under a point (0 = street level). */
export function groundHeightAt(x: number, z: number): number {
  let best = 0;
  for (const c of nearby(x, z)) {
    if (
      x >= c.x - c.hw - PLAYER_RADIUS * 0.5 &&
      x <= c.x + c.hw + PLAYER_RADIUS * 0.5 &&
      z >= c.z - c.hd - PLAYER_RADIUS * 0.5 &&
      z <= c.z + c.hd + PLAYER_RADIUS * 0.5
    ) {
      if (c.top > best) best = c.top;
    }
  }
  return best;
}

/**
 * Distance from `origin` along a horizontal direction before hitting a solid.
 * Used to pull the third-person camera in when a wall is behind the player.
 */
export function castCameraRay(
  ox: number,
  oz: number,
  dirX: number,
  dirZ: number,
  maxDist: number,
  height: number,
): number {
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * maxDist;
    const px = ox + dirX * t;
    const pz = oz + dirZ * t;
    for (const c of nearby(px, pz)) {
      if (c.top < height) continue;
      if (
        px > c.x - c.hw - 0.3 &&
        px < c.x + c.hw + 0.3 &&
        pz > c.z - c.hd - 0.3 &&
        pz < c.z + c.hd + 0.3
      ) {
        return Math.max(1.6, t - 0.4);
      }
    }
  }
  return maxDist;
}
