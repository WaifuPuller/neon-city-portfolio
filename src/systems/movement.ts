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
