import React, { Suspense, lazy, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { QUALITY_PROFILES } from '../../utils/device';

/**
 * The whole 3D scene is a lazy chunk. Three.js, drei and postprocessing are
 * roughly a megabyte of JavaScript; splitting them out means the start screen
 * paints immediately and the engine streams in behind the loading bar.
 */
const Scene = lazy(() => import('./Scene'));

/** Reports drei's asset loading progress into the store for the loading screen. */
const ProgressReporter: React.FC = () => {
  const { progress, active } = useProgress();
  const setLoadProgress = useGameStore((s) => s.setLoadProgress);

  useEffect(() => {
    if (active) setLoadProgress(progress);
  }, [progress, active, setLoadProgress]);

  return null;
};

/**
 * Signals that the engine is live.
 *
 * Mounting here means the lazy Scene chunk and its whole module graph have
 * loaded and the renderer exists, which is the meaningful definition of ready.
 *
 * Deliberately NOT gated on requestAnimationFrame. Waiting for a composited
 * frame sounds more correct, but rAF does not fire at all in a tab that never
 * paints — a background tab, a collapsed panel, an offscreen iframe — and the
 * visitor would be left staring at a permanently disabled button with no way
 * into the site. setTimeout is throttled in those conditions but never stops,
 * so it always resolves.
 */
const ReadySignal: React.FC<{ onReady: () => void }> = ({ onReady }) => {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    if (!gl) return;
    const id = window.setTimeout(onReady, 60);
    return () => window.clearTimeout(id);
  }, [onReady, gl]);

  return null;
};

interface Props {
  onReady: () => void;
  onCaption: (c: string | null) => void;
  onContextLost: () => void;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}

export const GameCanvas: React.FC<Props> = ({ onReady, onCaption, onContextLost, canvasRef }) => {
  const quality = useGameStore((s) => s.quality);
  const profile = QUALITY_PROFILES[quality];

  return (
    <Canvas
      dpr={profile.dpr}
      shadows={profile.shadows}
      gl={{
        antialias: profile.antialias,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
        depth: true,
      }}
      camera={{ position: [0, 62, -78], fov: 58, near: 0.1, far: 400 }}
      onCreated={({ gl, scene }) => {
        canvasRef.current = gl.domElement;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.matrixWorldAutoUpdate = true;

        gl.domElement.addEventListener(
          'webglcontextlost',
          (e) => {
            e.preventDefault();
            onContextLost();
          },
          { passive: false },
        );
      }}
      className="absolute inset-0 h-full w-full"
    >
      <ProgressReporter />
      <Suspense fallback={null}>
        <Scene onCaption={onCaption} />
        <ReadySignal onReady={onReady} />
      </Suspense>
    </Canvas>
  );
};
