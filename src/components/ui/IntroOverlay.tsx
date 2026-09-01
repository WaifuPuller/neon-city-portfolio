import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkipForward } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

/**
 * Letterbox bars, shot captions and a skip affordance layered over the
 * cinematic camera move. Purely presentational; the camera itself is driven
 * by CinematicIntro inside the canvas.
 */
export const IntroOverlay: React.FC<{ caption: string | null }> = ({ caption }) => {
  const phase = useGameStore((s) => s.phase);
  const skipIntro = useGameStore((s) => s.skipIntro);
  const [showSkip, setShowSkip] = useState(false);

  const active = phase === 'INTRO';

  useEffect(() => {
    if (!active) {
      setShowSkip(false);
      return;
    }
    const t = setTimeout(() => setShowSkip(true), 900);
    return () => clearTimeout(t);
  }, [active]);

  // Any key or click skips ahead.
  useEffect(() => {
    if (!active) return;
    const skip = () => skipIntro();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [active, skipIntro]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-none absolute inset-0 z-[70]"
        >
          {/* Letterbox */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: '11vh' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-0 bg-black"
          />
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: '11vh' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 bg-black"
          />

          {/* Opening fade from black */}
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            className="absolute inset-0 bg-black"
          />

          {/* Caption */}
          <div className="absolute inset-x-0 bottom-[13vh] flex justify-center px-6">
            <AnimatePresence mode="wait">
              {caption && (
                <motion.div
                  key={caption}
                  initial={{ opacity: 0, y: 14, letterSpacing: '0.5em' }}
                  animate={{ opacity: 1, y: 0, letterSpacing: '0.28em' }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                  className="font-display text-[11px] font-bold text-neon-cyan/90 sm:text-sm"
                  style={{ textShadow: '0 0 22px rgba(34,211,238,0.55)' }}
                >
                  {caption}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Skip */}
          <AnimatePresence>
            {showSkip && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={skipIntro}
                className="pointer-events-auto absolute bottom-[13vh] right-6 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-white/50 transition hover:text-neon-cyan"
              >
                SKIP <SkipForward className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
