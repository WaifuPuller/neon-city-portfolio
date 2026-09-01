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
  const dpr = window.devicePixelRatio || 1;

  if (cores >= 8 && memory >= 8) return 'ultra';
  if (cores >= 4 && memory >= 4 && dpr <= 2) return 'high';
  return 'medium';
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
  /** Render rooftop spires, signage and other non-essential detail. */
  detail: boolean;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  ultra: { dpr: [1, 2], shadows: true, bloom: true, antialias: true, particles: 1400, fogFar: 190, detail: true },
  high: { dpr: [1, 1.75], shadows: true, bloom: true, antialias: true, particles: 900, fogFar: 160, detail: true },
  medium: { dpr: [1, 1.25], shadows: false, bloom: true, antialias: false, particles: 450, fogFar: 130, detail: true },
  low: { dpr: [0.75, 1], shadows: false, bloom: false, antialias: false, particles: 160, fogFar: 95, detail: false },
};
