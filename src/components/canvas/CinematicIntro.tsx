import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { portfolio } from '../../config/portfolio';

/* ---------------------------------------------------------------------------
 * Scripted camera move played once between START and PLAYING.
 *
 * Timed against the wall clock, NOT accumulated frame deltas. The delta
 * approach stretched the whole sequence on a slow machine — at 15fps a
 * three second shot took eight — which is exactly the situation where you
 * least want to hold someone up. Now it always takes the same wall-clock
 * time and simply plays at whatever framerate the device manages.
 * ------------------------------------------------------------------------- */

interface Shot {
  /** Fraction of the total duration this shot occupies. */
  weight: number;
  from: [number, number, number];
  to: [number, number, number];
  lookFrom: [number, number, number];
  lookTo: [number, number, number];
  caption?: string;
}

const SHOTS: Shot[] = [
  {
    weight: 0.45,
    from: [16, 34, -52],
    to: [8, 16, -30],
    lookFrom: [0, 12, 20],
    lookTo: [0, 4, 6],
    caption: 'SECTOR 07 — NEON DISTRICT',
  },
  {
    // Settles exactly where the gameplay camera starts (yaw = PI, behind the
    // player looking north up the boulevard) so the handover has no snap.
    weight: 0.55,
    from: [8, 16, -30],
    to: [0, 3.9, -7.4],
    lookFrom: [0, 4, 6],
    lookTo: [0, 1.5, 0],
  },
];

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();

export const CinematicIntro: React.FC<{ onCaption: (c: string | null) => void }> = ({
  onCaption,
}) => {
  const { camera } = useThree();
  const startedAt = useRef<number | null>(null);
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const lastCaption = useRef<string | null>(null);

  const duration = Math.max(0, portfolio.intro.durationSeconds) * 1000;

  useEffect(() => {
    if (phase !== 'INTRO') {
      startedAt.current = null;
      return;
    }
    // Skipped or disabled entirely: hand straight over to gameplay.
    if (!portfolio.intro.enabled || duration <= 0) {
      onCaption(null);
      setPhase('PLAYING');
    }
  }, [phase, duration, onCaption, setPhase]);

  useFrame(() => {
    if (phase !== 'INTRO' || !portfolio.intro.enabled || duration <= 0) return;

    const now = performance.now();
    if (startedAt.current === null) startedAt.current = now;

    const elapsed = now - startedAt.current;
    if (elapsed >= duration) {
      onCaption(null);
      setPhase('PLAYING');
      return;
    }

    // Locate the active shot by weight.
    let t = elapsed / duration;
    let shot = SHOTS[0];
    for (const s of SHOTS) {
      if (t < s.weight) {
        shot = s;
        break;
      }
      t -= s.weight;
      shot = s;
    }
    const k = smoothstep(Math.min(1, t / shot.weight));

    _pos.set(
      THREE.MathUtils.lerp(shot.from[0], shot.to[0], k),
      THREE.MathUtils.lerp(shot.from[1], shot.to[1], k),
      THREE.MathUtils.lerp(shot.from[2], shot.to[2], k),
    );
    _look.set(
      THREE.MathUtils.lerp(shot.lookFrom[0], shot.lookTo[0], k),
      THREE.MathUtils.lerp(shot.lookFrom[1], shot.lookTo[1], k),
      THREE.MathUtils.lerp(shot.lookFrom[2], shot.lookTo[2], k),
    );

    camera.position.copy(_pos);
    camera.lookAt(_look);

    const caption = shot.caption ?? null;
    if (caption !== lastCaption.current) {
      lastCaption.current = caption;
      onCaption(caption);
    }
  });

  return null;
};
