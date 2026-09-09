import React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../../store/useGameStore';

/* ---------------------------------------------------------------------------
 * Camera move for the world chooser.
 *
 * A slow arc around the plaza so the world being previewed is actually on
 * screen behind the cards. Nothing else drives the camera during SELECT -
 * CinematicIntro only runs during INTRO, and the Player only takes over once
 * play has started - so there is no contention here.
 * ------------------------------------------------------------------------- */

const RADIUS = 38;
const HEIGHT = 15;
/** Radians per second. Slow enough to read as drifting, not spinning. */
const SPEED = 0.085;

/** Roughly the middle of the first stretch of street, so there is something
 *  in frame from every angle. */
const FOCUS: [number, number, number] = [0, 5, 20];

export const PreviewOrbit: React.FC = () => {
  const { camera } = useThree();
  const phase = useGameStore((s) => s.phase);

  useFrame((state) => {
    if (phase !== 'SELECT') return;

    const t = state.clock.elapsedTime * SPEED;
    camera.position.set(
      Math.sin(t) * RADIUS,
      HEIGHT + Math.sin(t * 0.7) * 2.5,
      Math.cos(t) * RADIUS + FOCUS[2],
    );
    camera.lookAt(FOCUS[0], FOCUS[1], FOCUS[2]);
  });

  return null;
};
