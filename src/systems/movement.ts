/* ---------------------------------------------------------------------------
 * Movement tuning, in one place.
 *
 * The physics loop and the animation state machine both need these numbers,
 * and they must agree: if the animation thinks "running" starts at a different
 * speed than the controller can actually reach, the run cycle either never
 * plays or never stops. They used to be duplicated in two files, which is a
 * bug waiting to happen the first time one is tuned and the other is not.
 * ------------------------------------------------------------------------- */

export const WALK_SPEED = 7.4;
export const SPRINT_SPEED = 13.2;

/** How quickly velocity approaches the target speed. */
export const ACCEL = 14;

export const GRAVITY = 26;
export const JUMP_VELOCITY = 9.4;

/**
 * How long a flat jump keeps the character off the ground: up and back down.
 * Used to stretch the jump animation so it lands exactly when the body does.
 */
export const JUMP_AIRTIME = (2 * JUMP_VELOCITY) / GRAVITY;

/** Above this speed the run cycle plays instead of the walk cycle. */
export const RUN_THRESHOLD = 9.5;
/** Below this speed the character is considered stationary. */
export const MOVE_THRESHOLD = 0.6;

/* ---------------------------------------------------------------------------
 * Turning.
 *
 * Velocity used to be damped on X and Z independently, which meant a change of
 * direction had to decelerate through zero and accelerate out the other side.
 * The time that takes is the same at any speed, but the GROUND you cover while
 * it happens is not: at a sprint you carry on for the better part of three
 * metres before the new heading takes effect, which reads as "steering does
 * nothing while sprinting". Turning first and then sprinting felt fine,
 * because by then the momentum already pointed the right way.
 *
 * So momentum is now rotated towards the wanted heading at a fixed angular
 * rate instead. A turn is as sharp at full sprint as it is at a walk.
 * ------------------------------------------------------------------------- */

/** Radians per second the body can swing its momentum through, on the ground. */
export const TURN_RATE = 18;

/** Much lower in the air, so a jump stays committed. */
export const AIR_TURN_RATE = 4;

/**
 * How much speed a hard corner scrubs off, at a full reversal.
 * Recovered as soon as the body is pointing the right way again.
 */
export const TURN_SCRUB = 0.45;

/**
 * Advance horizontal velocity one step towards where the player is pointing.
 *
 * Pulled out of the frame loop so it can be exercised directly by a test:
 * "does a hard turn at a sprint actually change direction" is the sort of
 * thing that is very easy to get subtly wrong and very hard to eyeball.
 *
 * Returns the new [vx, vz].
 */
export function steerVelocity(
  vx: number,
  vz: number,
  /** Unit vector the player is asking for, or (0, 0) for "stop". */
  wishX: number,
  wishZ: number,
  targetSpeed: number,
  /** How hard the legs can push: ACCEL on the ground, less in the air. */
  accel: number,
  turnRate: number,
  delta: number,
): [number, number] {
  const damp = (a: number, b: number, lambda: number, dt: number) =>
    b + (a - b) * Math.exp(-lambda * dt);

  const moving = wishX !== 0 || wishZ !== 0;
  const speedNow = Math.hypot(vx, vz);

  // From a standstill, or when stopping, there is no heading to rotate.
  if (!moving || speedNow <= 0.4) {
    return [
      damp(vx, wishX * targetSpeed, accel, delta),
      damp(vz, wishZ * targetSpeed, accel, delta),
    ];
  }

  const wishAngle = Math.atan2(wishX, wishZ);
  let heading = Math.atan2(vx, vz);

  let diff = wishAngle - heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const maxTurn = turnRate * delta;
  heading += Math.max(-maxTurn, Math.min(maxTurn, diff));

  // Lean off the throttle through a hard corner so a full reversal is a tight
  // pivot rather than a wide skid. Recovers within a few frames.
  const scrub = 1 - TURN_SCRUB * Math.min(1, Math.abs(diff) / Math.PI);
  const speed = damp(speedNow, targetSpeed * scrub, accel, delta);

  return [Math.sin(heading) * speed, Math.cos(heading) * speed];
}
