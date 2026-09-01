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
  /** Fired when the browser drops pointer lock (Esc, Alt, tab switch). */
  onPointerLockLost?: () => void;
}

/**
 * Attach global listeners. Returns a disposer.
 * `handlers` is read through a ref-like object so the caller can update the
 * callbacks without re-binding listeners.
 */
export function attachInput(
  canvas: HTMLElement,
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
      exitPointerLock();
      return;
    }

    // Always allow escape and the console key, even when input is disabled.
    if (code === 'escape') {
      handlers.current.onPause?.();
      return;
    }
    if (code === 'backquote') {
      e.preventDefault();
      handlers.current.onConsole?.();
      return;
    }

    // Never eat keystrokes while the visitor is typing in a form.
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
      return;
    }
    if (!opts.current.enabled) return;

    if (code === 'space') e.preventDefault();

    const alreadyDown = keys.has(code);
    keys.add(code);
    recompute();

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
    input.pointerLocked = document.pointerLockElement === canvas;

    if (wasLocked && !input.pointerLocked) {
      // Esc both exits pointer lock AND is swallowed by the browser, so the
      // keydown handler never sees it. Without this the pause menu would
      // simply never open once the mouse had been captured.
      clearInput();
      handlers.current.onPointerLockLost?.();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    clearInput();
  };
}

/** Set once the browser has refused pointer lock, so we stop asking. */
let pointerLockBlocked = false;

export function requestPointerLock(canvas: HTMLElement) {
  if (pointerLockBlocked || document.pointerLockElement === canvas) return;
  try {
    // Chrome 111+ returns a promise here; older browsers return undefined.
    // An unhandled rejection would spam the console on every click inside an
    // iframe (which is exactly where pointer lock tends to be disallowed).
    const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        pointerLockBlocked = true;
      });
    }
  } catch {
    // Safari and sandboxed iframes throw synchronously instead.
    pointerLockBlocked = true;
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
