import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { GameCanvas } from './components/canvas/GameCanvas';
import { ErrorBoundary } from './components/core/ErrorBoundary';
import { NoWebGLFallback } from './components/core/NoWebGLFallback';

import { StartScreen } from './components/ui/StartScreen';
import { HUD } from './components/ui/HUD';
import { IntroOverlay } from './components/ui/IntroOverlay';
import { Toasts } from './components/ui/Toasts';
import { TouchControls } from './components/ui/TouchControls';
import { PauseMenu, SettingsModal } from './components/ui/PauseMenu';
import { Console } from './components/ui/Console';
import { WorldMap } from './components/ui/WorldMap';

import { ModalRoot } from './components/modals/ModalRoot';

import { useGameStore } from './store/useGameStore';
import { attachInput, clearInput, exitPointerLock, requestPointerLock } from './systems/input';
import { hasWebGL, isTouchDevice } from './utils/device';
import { audio } from './utils/audioSynth';
import { useViewportFit } from './hooks/useViewportFit';

export const App: React.FC = () => {
  // Track the space the browser actually gives us, so mobile Chrome's address
  // bar sliding in and out cannot cover the top of the HUD.
  useViewportFit();

  const phase = useGameStore((s) => s.phase);
  const activeModal = useGameStore((s) => s.activeModal);
  const loadProgress = useGameStore((s) => s.loadProgress);
  const sensitivity = useGameStore((s) => s.mouseSensitivity);
  const invertY = useGameStore((s) => s.invertY);
  const setLoadProgress = useGameStore((s) => s.setLoadProgress);

  const [engineReady, setEngineReady] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const webglOk = useMemo(() => hasWebGL(), []);
  const touch = useMemo(() => isTouchDevice(), []);

  /* --------------------------------------------------------- engine loading */
  /**
   * The start screen is DOM and paints almost immediately; the ~290 KB of
   * Three.js streams in behind it. So rather than blocking on a full-screen
   * loader, we show the page straight away and only gate the ENTER button.
   */
  useEffect(() => {
    if (engineReady || !webglOk) return;
    let current = 0;
    const timer = window.setInterval(() => {
      current = Math.min(92, current + Math.random() * 8 + 4);
      setLoadProgress(current);
    }, 200);
    return () => window.clearInterval(timer);
  }, [engineReady, webglOk, setLoadProgress]);

  const handleReady = useCallback(() => {
    setLoadProgress(100);
    setEngineReady(true);
  }, [setLoadProgress]);

  /**
   * Last-resort safety net. If the ready signal never arrives — a stalled
   * chunk, an exotic browser, a tab that has been throttled into the ground —
   * unlock the button anyway after 12 seconds. A visitor who can never press
   * ENTER is a far worse outcome than one who presses it a moment early.
   */
  useEffect(() => {
    if (engineReady || !webglOk) return;
    const timer = window.setTimeout(() => {
      console.warn('[portfolio] engine ready signal timed out; unlocking anyway.');
      handleReady();
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [engineReady, webglOk, handleReady]);

  /* -------------------------------------------------------------- inputs */

  const handlers = useRef({
    onInteract: () => {
      const s = useGameStore.getState();
      if (s.phase !== 'PLAYING' || s.activeModal || !s.nearbyZone) return;
      s.openModal(s.nearbyZone.modal);
    },
    onPause: () => {
      const s = useGameStore.getState();
      if (s.activeModal) {
        s.closeModal();
        return;
      }
      if (s.phase === 'PLAYING' || s.phase === 'PAUSED') s.togglePause();
    },
    onConsole: () => {
      const s = useGameStore.getState();
      if (s.phase !== 'PLAYING') return;
      if (s.activeModal === 'console') s.closeModal();
      else if (!s.activeModal) s.openModal('console');
    },
    onMap: () => {
      const s = useGameStore.getState();
      if (s.phase !== 'PLAYING') return;
      if (s.activeModal === 'map') s.closeModal();
      else if (!s.activeModal) s.openModal('map');
    },
    /**
     * The browser eats the Esc keydown that exits pointer lock, so the key
     * handler never fires and the pause menu would never open once the mouse
     * was captured. Reacting to the lock being dropped restores it.
     */
    onPointerLockLost: () => {
      const s = useGameStore.getState();
      if (s.phase === 'PLAYING' && !s.activeModal) s.togglePause();
    },
  });

  const inputOpts = useRef({ sensitivity, invertY, enabled: false });
  inputOpts.current.sensitivity = sensitivity;
  inputOpts.current.invertY = invertY;
  inputOpts.current.enabled = phase === 'PLAYING' && activeModal === null;

  useEffect(() => {
    const target = shellRef.current;
    if (!target) return;
    return attachInput(target, handlers, inputOpts);
  }, []);

  /* Pointer lock follows the game state rather than being toggled by hand.
     Releasing held keys at the same time stops the avatar resuming a sprint
     that was started before a modal opened. */
  useEffect(() => {
    if (phase === 'PLAYING' && activeModal === null) return;
    clearInput();
    if (!touch) exitPointerLock();
  }, [phase, activeModal, touch]);

  const captureMouse = useCallback(() => {
    if (touch) return;
    const s = useGameStore.getState();
    if (s.phase !== 'PLAYING' || s.activeModal) return;
    if (canvasRef.current) requestPointerLock(canvasRef.current);
  }, [touch]);

  /* Pause automatically when the tab loses focus, so nobody comes back to a
     character that has been sprinting into a wall for five minutes. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && useGameStore.getState().phase === 'PLAYING') {
        useGameStore.getState().togglePause();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  /* Stop the music when the page goes away. */
  useEffect(() => () => audio.stopMusic(), []);

  const handleContextLost = useCallback(() => setContextLost(true), []);

  /* ---------------------------------------------------------------- render */

  if (!webglOk) {
    return (
      <ErrorBoundary>
        <div className="relative h-full w-full bg-void-950">
          <NoWebGLFallback reason="unsupported" />
          <ModalRoot />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary fallback={<NoWebGLFallback reason="lost" />}>
      <div
        ref={shellRef}
        onPointerDown={captureMouse}
        className="scanlines relative h-full w-full overflow-hidden bg-void-950"
      >
        {/* 3D engine */}
        {!contextLost && (
          <GameCanvas
            onReady={handleReady}
            onCaption={setCaption}
            onContextLost={handleContextLost}
            canvasRef={canvasRef}
          />
        )}

        {contextLost && <NoWebGLFallback reason="lost" />}

        {/* Cinematic */}
        <IntroOverlay caption={caption} />

        {/* HUD + controls */}
        <HUD touch={touch} />
        {touch && <TouchControls />}
        <Toasts />

        {/* Screens */}
        <AnimatePresence>
          {phase === 'START' && (
            <StartScreen key="start" touch={touch} ready={engineReady} progress={loadProgress} />
          )}
        </AnimatePresence>

        <PauseMenu />

        {/* Content panels */}
        <AnimatePresence mode="wait">
          {activeModal === 'settings' && <SettingsModal key="settings" />}
          {activeModal === 'console' && <Console key="console" />}
          {activeModal === 'map' && <WorldMap key="map" />}
        </AnimatePresence>
        <ModalRoot />
      </div>
    </ErrorBoundary>
  );
};

export default App;
