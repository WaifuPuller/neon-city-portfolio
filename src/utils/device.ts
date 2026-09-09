import { QualityLevel } from '../types/game';

/**
 * True when touch is the *primary* input, i.e. we should show the virtual pad.
 *
 * Deliberately keyed on `pointer: coarse` rather than `maxTouchPoints`: a
 * Windows laptop with a touchscreen reports 10 touch points but still has a
 * mouse as its primary pointer, and would otherwise be handed phone controls.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarsePrimary = window.matchMedia('(pointer: coarse)').matches;
  const hasFinePointer = window.matchMedia('(any-pointer: fine)').matches;
  return coarsePrimary || (navigator.maxTouchPoints > 0 && !hasFinePointer);
}

export function isSmallScreen(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 820px)').matches;
}

/** Detect WebGL support so we can show a graceful fallback instead of a blank canvas. */
export function hasWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Pick a sensible starting quality from the hardware. The user can always
 * override this in Settings; this only decides the first-run default so that
 * a phone does not try to render the ultra preset and drop to 12fps.
 */
export function detectQuality(): QualityLevel {
  if (typeof window === 'undefined') return 'high';
  // Only touch-primary devices get the low preset. A narrow *window* on a
  // desktop has fewer pixels to fill, so it can afford more effects, not fewer.
  if (isTouchDevice()) return 'low';

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;

  // Deliberately pessimistic. Core count says nothing about the GPU, and most
  // laptops report 8+ cores while running integrated graphics that cannot
  // afford bloom at full resolution. Start low-ish, then let AdaptiveQuality
  // measure the real framerate and settle on the right level.
  if (cores >= 12 && memory >= 8) return 'high';
  if (cores >= 8 && memory >= 8) return 'medium';
  return 'low';
}

export interface QualityProfile {
  /** Device pixel ratio cap. */
  dpr: [number, number];
  shadows: boolean;
  bloom: boolean;
  antialias: boolean;
  /** Number of floating dust particles. */
  particles: number;
  /** Draw distance for the fog. */
  fogFar: number;
  /**
   * Instanced decoration: lit windows, spires, street furniture, hull panels.
   *
   * On even the weakest hardware this is close to free - each layer is one
   * draw call however many objects are in it - so it is now on everywhere.
   * The flag stays because a future addition might not be.
   */
  detail: boolean;
}

/**
 * Tuned down after profiling the deployed build.
 *
 * Device pixel ratio is the single most expensive knob: at dpr 2 the GPU fills
 * four times the pixels, and bloom re-reads the whole frame on top. Capping at
 * 1.5 is visually near-identical on a laptop screen and roughly halves the
 * fragment cost. Shadows are reserved for the ultra preset for the same reason.
 */
export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  ultra: { dpr: [1, 1.5], shadows: true, bloom: true, antialias: true, particles: 700, fogFar: 175, detail: true },
  high: { dpr: [1, 1.25], shadows: false, bloom: true, antialias: true, particles: 450, fogFar: 150, detail: true },
  medium: { dpr: [1, 1], shadows: false, bloom: true, antialias: false, particles: 250, fogFar: 125, detail: true },
  /*
   * Low keeps everything that is cheap and drops only what is genuinely
   * expensive.
   *
   * It used to switch off `detail` as well, which saved almost nothing - that
   * geometry is instanced, so it is a handful of draw calls whether it holds
   * ten objects or four thousand - while removing the lit windows, the street
   * furniture and every scrap of surface interest. The result was flat grey
   * boxes in thick fog, and the honest reason the low preset looked lifeless.
   *
   * The real cost on weak hardware is full-screen work: bloom re-reads the
   * whole frame several times, shadows add an entire render pass, and pixel
   * ratio multiplies every fragment. Those stay off. A cheap glow stands in
   * for the missing bloom.
   */
  low: { dpr: [0.75, 1], shadows: false, bloom: false, antialias: false, particles: 110, fogFar: 118, detail: true },
};
