import { WORLD_BOUNDS } from './world';

/* ---------------------------------------------------------------------------
 * One shared top-down projection for BOTH maps (the corner radar and the
 * full-screen map), so they can never disagree about which way round the city
 * is.
 *
 * THE THING THAT WAS WRONG
 * ------------------------
 * three.js is right-handed: X to the right, Y up, Z towards the viewer. The
 * radar used to draw world +X on the right of the screen, which quietly put
 * the map UNDER the city looking up, not above it looking down — every
 * landmark appeared on the opposite side to where it really was.
 *
 * Look straight down at the ground with world +Z at the top of the image and
 * your screen-right is world -X, not +X. So the horizontal axis is flipped
 * here once, in the only place that projects world space onto a map.
 * ------------------------------------------------------------------------- */

export const MAP_SPAN_X = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
export const MAP_SPAN_Z = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;

const CENTRE_X = (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2;
const CENTRE_Z = (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2;

export interface Projection {
  /** Pixels per world unit. */
  scale: number;
  width: number;
  height: number;
  /** World (x, z) to map pixels. */
  project: (x: number, z: number) => [number, number];
}

/** Fit the whole city into a `width` x `height` box, keeping it square-on. */
export function makeProjection(width: number, height: number, pad = 6): Projection {
  const scale = Math.min((width - pad * 2) / MAP_SPAN_X, (height - pad * 2) / MAP_SPAN_Z);
  const ox = width / 2;
  const oy = height / 2;

  return {
    scale,
    width,
    height,
    // Both axes are negated: -X is screen-right and +Z is screen-up, which is
    // what you actually see looking down on a right-handed world.
    project: (x, z) => [ox - (x - CENTRE_X) * scale, oy - (z - CENTRE_Z) * scale],
  };
}

/**
 * Rotation for a marker that is drawn pointing "up" the map, given a world
 * direction. Works for both canvas `rotate()` and SVG `rotate()`, since both
 * measure clockwise from twelve o'clock in screen space.
 */
export function screenAngle(dirX: number, dirZ: number): number {
  return Math.atan2(-dirX, dirZ);
}

/** The same thing for a player yaw, whose forward vector is (-sin, -cos). */
export function headingAngle(yaw: number): number {
  return screenAngle(-Math.sin(yaw), -Math.cos(yaw));
}

/* ------------------------------------------------------------------ labels */

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Greedy label placement: keep a list of the boxes already drawn and refuse
 * any that would overlap one. Landmarks are placed in priority order, so on
 * the cramped corner radar the important ones win and the rest simply go
 * unlabelled rather than turning into a pile of overlapping text.
 */
export class LabelLayout {
  private boxes: LabelBox[] = [];

  /** Returns false if this box collides with one already accepted. */
  place(box: LabelBox): boolean {
    for (const b of this.boxes) {
      if (
        box.x < b.x + b.w &&
        box.x + box.w > b.x &&
        box.y < b.y + b.h &&
        box.y + box.h > b.y
      ) {
        return false;
      }
    }
    this.boxes.push(box);
    return true;
  }

  reset() {
    this.boxes = [];
  }
}
