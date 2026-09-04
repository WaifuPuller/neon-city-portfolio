/* ---------------------------------------------------------------------------
 * Input is kept in a plain mutable object rather than React state.
 *
 * Movement is sampled every frame; routing it through the store would trigger
 * a re-render of the whole tree 60 times a second. Components that need to
 * *react* to input (the pause menu, the interact prompt) still go through
 * zustand; this module is only the raw per-frame signal.
 * ------------------------------------------------------------------------- */

export interface InputState {
  forward: number; // -1..1
  strafe: number; // -1..1
  jump: boolean;
  sprint: boolean;
  /** Accumulated mouse/touch look delta, consumed and zeroed each frame. */
  lookX: number;
  lookY: number;
  /** True while the pointer is locked to the canvas. */
  pointerLocked: boolean;
}

export const input: InputState = {
  forward: 0,
  strafe: 0,
  jump: false,
  sprint: false,
  lookX: 0,
  lookY: 0,
  pointerLocked: false,
};

const keys = new Set<string>();

/** Keys that mean "I am playing now", used to capture the mouse. */
const MOVEMENT_KEYS = new Set([
  'keyw', 'keya', 'keys', 'keyd',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'space',
]);

/**
 * True while the visitor has deliberately freed the cursor with Alt.
 *
 * Without this the auto-capture above would take the mouse straight back on
 * the next step, which is the exact opposite of what Alt is for.
 */
let cursorFreed = false;

/** Set by the touch pad component; overrides keyboard when non-zero. */
export const touch = { forward: 0, strafe: 0, active: false };

function recompute() {
  let f = 0;
  let s = 0;
  if (keys.has('keyw') || keys.has('arrowup')) f += 1;
  if (keys.has('keys') || keys.has('arrowdown')) f -= 1;
  if (keys.has('keyd') || keys.has('arrowright')) s += 1;
  if (keys.has('keya') || keys.has('arrowleft')) s -= 1;

  if (touch.active) {
    f = touch.forward;
    s = touch.strafe;
  }

  input.forward = f;
  input.strafe = s;
  input.sprint = shiftHeld || touchSprint;
  input.jump = keys.has('space') || touchJump;
}

let touchSprint = false;
let touchJump = false;

/**
 * Modifier state is read from `event.shiftKey` rather than tracked in `keys`.
 *
 * Holding Shift and then alt-tabbing (or opening devtools, or any focus change
 * that swallows the keyup) would otherwise leave Shift latched forever, which
 * reads to the player as "sprint is permanently stuck on". Deriving it from
 * each event means the very next keystroke self-corrects.
 */
let shiftHeld = false;

export function setTouchSprint(v: boolean) {
  touchSprint = v;
  recompute();
}
export function setTouchJump(v: boolean) {
  touchJump = v;
  recompute();
}
export function setTouchMove(forward: number, strafe: number, active: boolean) {
  touch.forward = forward;
  touch.strafe = strafe;
  touch.active = active;
  recompute();
}

export function clearInput() {
  keys.clear();
  shiftHeld = false;
  touchSprint = false;
  touchJump = false;
  touch.active = false;
  touch.forward = 0;
  touch.strafe = 0;
  recompute();
  input.lookX = 0;
  input.lookY = 0;
}

/** Consume the accumulated look delta. */
export function takeLook(): [number, number] {
  const x = input.lookX;
  const y = input.lookY;
  input.lookX = 0;
  input.lookY = 0;
  return [x, y];
}

export interface InputHandlers {
  onJumpPressed?: () => void;
  onInteract?: () => void;
  onPause?: () => void;
  onConsole?: () => void;
  /** Toggle the full-screen city map (M). */
  onMap?: () => void;
  /**
   * Fired when the visitor starts moving without the mouse being captured.
   * A keystroke counts as a user gesture, so pointer lock can be requested
   * from it - see the note on MOVEMENT_KEYS.
   */
  onRequestCapture?: () => void;
  /** Fired when the browser drops pointer lock (Esc, Alt, tab switch). */
  onPointerLockLost?: () => void;
}

/**
 * Attach global listeners. Returns a disposer.
 * `handlers` is read through a ref-like object so the caller can update the
 * callbacks without re-binding listeners.
 */
export function attachInput(
  /**
   * The wrapper element, NOT the canvas. Pointer lock is requested on the
   * <canvas> inside it, so lock state is tested by containment rather than
   * identity - comparing the two directly meant pointerLocked was always
   * false and mouse look never engaged at all.
   */
  root: HTMLElement,
  handlers: { current: InputHandlers },
  opts: { current: { sensitivity: number; invertY: boolean; enabled: boolean } },
) {
  const onKeyDown = (e: KeyboardEvent) => {
    const code = e.code.toLowerCase();

    // Resync modifiers from the event before any early return, so a dropped
    // keyup cannot latch sprint on.
    shiftHeld = e.shiftKey;
    recompute();

    // Alt releases the mouse so the cursor can be used on the HUD. Held or
    // tapped, either works; the browser also surrenders pointer lock on Alt
    // in some window managers, which this keeps consistent with.
    if (code === 'altleft' || code === 'altright') {
      e.preventDefault();
      // Flagged so the lock-change handler knows this was deliberate and does
      // not pause the game - the whole point of Alt is to free the cursor
      // while play continues.
      pointerLockReleasedByUser = true;
      cursorFreed = true;
      exitPointerLock();
      return;
    }

    // Escape works everywhere, including inside the contact form.
    if (code === 'escape') {
      handlers.current.onPause?.();
      return;
    }

    // Never eat keystrokes while the visitor is typing in a form. This has to
    // come BEFORE the shortcut keys: 'm' is an ordinary letter, and opening
    // the world map every time someone types it into the contact message
    // would be maddening.
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
      return;
    }

    // Panels that toggle, and so must keep working while they are open (when
    // `enabled` is false because a modal has the screen).
    if (code === 'backquote') {
      e.preventDefault();
      handlers.current.onConsole?.();
      return;
    }
    if (code === 'keym') {
      e.preventDefault();
      handlers.current.onMap?.();
      return;
    }

    if (!opts.current.enabled) return;

    if (code === 'space') e.preventDefault();

    const alreadyDown = keys.has(code);
    keys.add(code);
    recompute();

    /* Grab the mouse as soon as the visitor starts walking.
     *
     * Pointer lock can only be requested from a user gesture, and the only
     * one the game used to take was a click on the canvas. But the intro
     * releases the mouse on its way past, so after it finished nobody held
     * the lock: the natural thing to do next is press W, walk off, and then
     * discover that the mouse does not turn the camera at all until you
     * happen to click. A keystroke is a user gesture too, so starting to
     * move is treated as "I would like to play now".
     *
     * Skipped when the cursor was freed deliberately with Alt, which would
     * otherwise snatch it straight back. */
    if (!alreadyDown && MOVEMENT_KEYS.has(code) && !input.pointerLocked && !cursorFreed) {
      handlers.current.onRequestCapture?.();
    }

    if (code === 'space' && !alreadyDown) handlers.current.onJumpPressed?.();
    if (code === 'keye' && !alreadyDown) handlers.current.onInteract?.();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code.toLowerCase());
    shiftHeld = e.shiftKey;
    recompute();
  };

  // Losing focus (alt-tab, devtools, clicking the address bar) drops every
  // pending keyup, so release everything rather than leaving keys latched.
  const onBlur = () => clearInput();

  const onMouseMove = (e: MouseEvent) => {
    if (!input.pointerLocked || !opts.current.enabled) return;
    const sens = opts.current.sensitivity * 0.0022;
    input.lookX += e.movementX * sens;
    input.lookY += e.movementY * sens * (opts.current.invertY ? -1 : 1);
  };

  // Drag-to-look fallback for when the pointer is not locked (and on tablets).
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onPointerDown = (e: PointerEvent) => {
    if (!opts.current.enabled) return;
    if (e.pointerType === 'touch') return; // handled by the touch look pad
    // Clicking back into the view means they want the mouse captured again.
    cursorFreed = false;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || input.pointerLocked || !opts.current.enabled) return;
    const sens = opts.current.sensitivity * 0.0022;
    input.lookX += (e.clientX - lastX) * sens;
    input.lookY += (e.clientY - lastY) * sens * (opts.current.invertY ? -1 : 1);
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onPointerUp = () => {
    dragging = false;
  };

  const onPointerLockChange = () => {
    const wasLocked = input.pointerLocked;
    const locked = document.pointerLockElement;
    input.pointerLocked = !!locked && (locked === root || root.contains(locked));

    if (wasLocked && !input.pointerLocked) {
      clearInput();

      if (pointerLockReleasedByUser) {
        // Alt: the visitor wants the cursor back but is still playing.
        pointerLockReleasedByUser = false;
      } else {
        // Esc both exits pointer lock AND is swallowed by the browser, so the
        // keydown handler never sees it. Without this the pause menu would
        // simply never open once the mouse had been captured.
        handlers.current.onPointerLockLost?.();
      }
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  root.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('mousemove', onMouseMove);
    root.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    clearInput();
  };
}

/**
 * Consecutive pointer-lock refusals.
 *
 * Chrome RATE LIMITS pointer lock: after exiting with Esc, re-requesting
 * within roughly a second is rejected with a SecurityError. Treating a single
 * refusal as permanent therefore killed mouse look for the rest of the
 * session the first time anyone pressed Esc and clicked back in. Only give up
 * after several failures in a row, and forget them all on success.
 */
let lockFailures = 0;
const MAX_LOCK_FAILURES = 4;

/**
 * Forget (or force) a deliberate Alt release.
 *
 * Cleared when play starts or resumes: freeing the cursor is a request about
 * the moment, not a standing preference, and someone who has just pressed
 * Resume plainly wants to play.
 */
export function markCursorFreed(v: boolean) {
  cursorFreed = v;
}

/** Set by the Alt handler so releasing the mouse does not also pause. */
export let pointerLockReleasedByUser = false;

export function markPointerLockReleasedByUser(v: boolean) {
  pointerLockReleasedByUser = v;
}

export function requestPointerLock(element: HTMLElement, speculative = false) {
  if (lockFailures >= MAX_LOCK_FAILURES) return;
  if (document.pointerLockElement === element) return;

  try {
    // Chrome 111+ returns a promise; older browsers return undefined. An
    // unhandled rejection would spam the console on every click in a context
    // where lock is disallowed, such as a sandboxed iframe.
    const result = element.requestPointerLock() as unknown as Promise<void> | undefined;
    if (result && typeof result.catch === 'function') {
      result.then(
        () => {
          lockFailures = 0;
        },
        () => {
          // A speculative attempt - one made without a fresh click behind it -
          // is EXPECTED to be refused sometimes, so it must not count towards
          // giving up permanently.
          if (!speculative) lockFailures += 1;
        },
      );
    } else {
      lockFailures = 0;
    }
  } catch {
    // Safari and sandboxed iframes throw synchronously instead.
    if (!speculative) lockFailures += 1;
  }
}

export function exitPointerLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

/** Shared, mutable snapshot of where the player is, for HUD/minimap readers. */
export const playerState = {
  x: 0,
  y: 1.1,
  z: 0,
  yaw: 0,
  speed: 0,
  grounded: true,
  distanceTravelled: 0,
};

/* Dev-only inspection hook. Stripped from production builds by Vite's
   import.meta.env.DEV constant folding. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __input: unknown }).__input = { input, playerState, keys };
}
