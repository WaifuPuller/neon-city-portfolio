import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';

/* ---------------------------------------------------------------------------
 * Scripted camera move played once between START and PLAYING.
 *
 * Each shot is a position + look-at pair; the rig eases between them with a
 * smoothstep so the cuts feel like a camera crane rather than a lerp.
 * ------------------------------------------------------------------------- */

interface Shot {
  /** Seconds this shot lasts. */
  duration: number;
  from: [number, number, number];
  to: [number, number, number];
  lookFrom: [number, number, number];
  lookTo: [number, number, number];
  /** Subtitle shown while this shot plays. */
  caption?: string;
}

const SHOTS: Shot[] = [
  {
    duration: 3.2,
    from: [0, 62, -78],
    to: [0, 40, -46],
    lookFrom: [0, 20, 20],
    lookTo: [0, 14, 30],
    caption: 'SECTOR 07 — NEON DISTRICT',
  },
  {
    duration: 3.0,
    from: [-44, 22, 26],
    to: [-16, 13, 30],
    lookFrom: [0, 10, 34],
    lookTo: [0, 6, 34],
    caption: 'AI RESEARCH LAB — ONLINE',
  },
  {
    duration: 2.8,
    from: [22, 11, -34],
    to: [7, 5.4, -17],
    lookFrom: [0, 5, 6],
    lookTo: [0, 1.7, 0],
    caption: 'OPERATOR LINK ESTABLISHED',
  },
  {
    // Settles exactly where the gameplay camera starts (yaw = PI, behind the
    // player looking north up the boulevard) so the handover has no snap.
    duration: 2.0,
    from: [7, 5.4, -17],
    to: [0, 3.9, -7.4],
    lookFrom: [0, 1.7, 0],
    lookTo: [0, 1.5, 0],
  },
];

const TOTAL = SHOTS.reduce((sum, s) => sum + s.duration, 0);

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();

export const CinematicIntro: React.FC<{ onCaption: (c: string | null) => void }> = ({
  onCaption,
}) => {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const lastCaption = useRef<string | null>(null);

  useEffect(() => {
    if (phase === 'INTRO') {
      elapsed.current = 0;
      lastCaption.current = null;
    }
  }, [phase]);

  useFrame((_, delta) => {
    if (phase !== 'INTRO') return;

    elapsed.current += Math.min(delta, 1 / 20);

    if (elapsed.current >= TOTAL) {
      onCaption(null);
      setPhase('PLAYING');
      return;
    }

    // Find the active shot and its local progress.
    let t = elapsed.current;
    let shot = SHOTS[0];
    for (const s of SHOTS) {
      if (t < s.duration) {
        shot = s;
        break;
      }
      t -= s.duration;
      shot = s;
    }
    const k = smoothstep(Math.min(1, t / shot.duration));

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

export const INTRO_DURATION = TOTAL;
