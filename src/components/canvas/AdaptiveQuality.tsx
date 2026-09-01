import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../store/useGameStore';
import { QualityLevel } from '../../types/game';

/* ---------------------------------------------------------------------------
 * Measures the real framerate and steps quality down until the scene is
 * smooth.
 *
 * Guessing from navigator.hardwareConcurrency is unreliable — core count says
 * nothing about the GPU, and integrated graphics in an 8-core laptop will
 * happily report itself as powerful and then struggle with a full-resolution
 * bloom pass. Measuring is the only honest signal.
 *
 * Only ever steps DOWN. Auto-upgrading would oscillate: raise the settings,
 * the framerate drops, lower them again, forever. And it stops entirely once
 * the visitor picks a level by hand, because an explicit choice should not be
 * silently overridden.
 * ------------------------------------------------------------------------- */

const ORDER: QualityLevel[] = ['ultra', 'high', 'medium', 'low'];

/** Below this sustained average, drop a level. */
const TARGET_FPS = 40;
/** Length of each measurement window, in seconds. */
const WINDOW = 3;
/** Ignore the first moments, while shaders compile and the scene warms up. */
const GRACE = 4;
/** Never step down more than this, so it cannot spiral to nothing. */
const MAX_STEPS = 2;

export const AdaptiveQuality: React.FC = () => {
  const elapsed = useRef(0);
  const windowTime = useRef(0);
  const frames = useRef(0);
  const steps = useRef(0);

  useFrame((_state, delta) => {
    const store = useGameStore.getState();

    // Only judge while actually playing, and only while unattended.
    if (!store.qualityAuto || store.phase !== 'PLAYING' || store.activeModal) return;
    if (steps.current >= MAX_STEPS) return;

    // Cap the contribution of any single frame: a garbage-collection pause or
    // an alt-tab should not be mistaken for a slow GPU.
    const dt = Math.min(delta, 0.5);

    elapsed.current += dt;
    if (elapsed.current < GRACE) return;

    windowTime.current += dt;
    frames.current += 1;

    if (windowTime.current < WINDOW) return;

    const fps = frames.current / windowTime.current;
    windowTime.current = 0;
    frames.current = 0;

    if (fps >= TARGET_FPS) return;

    const index = ORDER.indexOf(store.quality);
    if (index === -1 || index >= ORDER.length - 1) return; // already at 'low'

    const next = ORDER[index + 1];
    steps.current += 1;
    store.autoSetQuality(next);
    store.pushToast({
      kind: 'info',
      title: `GRAPHICS: ${next.toUpperCase()}`,
      body: `Running at ${Math.round(fps)} fps — lowered for smoothness. Change it in Settings.`,
      icon: 'zap',
    });
  });

  return null;
};
