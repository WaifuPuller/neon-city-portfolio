import type { NavTarget } from '../types/game';
import { findRoute, Route } from './navigation';

/* ---------------------------------------------------------------------------
 * The live route, computed once per tick and read by everything that draws it.
 *
 * Three separate things need the current path: the arrows on the ground, the
 * corner radar and the full-screen map. Kept in a mutable module object like
 * `playerState`, so the maps can read it without it becoming React state that
 * re-renders the HUD several times a second.
 * ------------------------------------------------------------------------- */

export const navState: {
  target: NavTarget | null;
  route: Route | null;
  /** Walking distance still to go, in world units. */
  remaining: number;
  /** True when the destination exists but nothing can walk to it. */
  unreachable: boolean;
} = {
  target: null,
  route: null,
  remaining: 0,
  unreachable: false,
};

/** Seconds between recomputes while walking. Cheap, but no reason to do it every frame. */
const INTERVAL = 0.4;

let nextComputeAt = 0;

export function clearNav() {
  navState.target = null;
  navState.route = null;
  navState.remaining = 0;
  navState.unreachable = false;
  nextComputeAt = 0;
}

/**
 * Refresh the route for the current target. Recomputes on a timer rather than
 * trying to be clever about when the player has strayed: a route across the
 * whole city costs a fraction of a millisecond, and always re-planning from
 * where the player actually is means the arrows correct themselves the moment
 * someone wanders off or takes a different street.
 */
export function updateNav(target: NavTarget | null, x: number, z: number, elapsed: number) {
  if (!target) {
    if (navState.target) clearNav();
    return;
  }

  const changed = navState.target?.id !== target.id;
  if (!changed && elapsed < nextComputeAt) return;

  navState.target = target;
  nextComputeAt = elapsed + INTERVAL;

  const route = findRoute(x, z, target.position[0], target.position[2]);
  navState.route = route;
  navState.unreachable = route === null;
  navState.remaining = route ? route.distance : Math.hypot(target.position[0] - x, target.position[2] - z);
}
