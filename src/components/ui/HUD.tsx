import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause,
  Volume2,
  VolumeX,
  Terminal,
  Trophy,
  Target,
  Gem,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { useGameStore, selectActiveQuest, selectCoreCount, xpForLevel, THEMES } from '../../store/useGameStore';
import { portfolio } from '../../config/portfolio';
import { Minimap } from './Minimap';
import { audio } from '../../utils/audioSynth';

/** Lightweight frame counter that never re-renders the rest of the HUD. */
const FpsMeter: React.FC = () => {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      frames++;
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const tone = fps >= 50 ? 'text-neon-mint' : fps >= 30 ? 'text-neon-amber' : 'text-neon-red';
  return <span className={`font-mono text-[10px] tabular-nums ${tone}`}>{fps} FPS</span>;
};

const IconButton: React.FC<{
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}> = ({ onClick, label, children, accent }) => (
  <button
    onClick={onClick}
    onMouseEnter={() => audio.uiHover()}
    title={label}
    aria-label={label}
    className={`glass flex h-10 w-10 items-center justify-center rounded-xl transition hover:scale-105 sm:h-11 sm:w-11 ${
      accent ? 'border-neon-cyan/50 text-neon-cyan' : 'text-slate-300 hover:text-neon-cyan'
    }`}
  >
    {children}
  </button>
);

export const HUD: React.FC<{ touch: boolean }> = ({ touch }) => {
  const phase = useGameStore((s) => s.phase);
  const activeModal = useGameStore((s) => s.activeModal);
  const level = useGameStore((s) => s.level);
  const xp = useGameStore((s) => s.xp);
  const nearby = useGameStore((s) => s.nearbyZone);
  const quest = useGameStore(selectActiveQuest);
  const quests = useGameStore((s) => s.quests);
  const cores = useGameStore(selectCoreCount);
  const sfxEnabled = useGameStore((s) => s.sfxEnabled);
  const showFps = useGameStore((s) => s.showFps);
  const theme = useGameStore((s) => s.theme);
  const achievements = useGameStore((s) => s.achievements);

  const togglePause = useGameStore((s) => s.togglePause);
  const toggleSfx = useGameStore((s) => s.toggleSfx);
  const openModal = useGameStore((s) => s.openModal);

  const palette = THEMES[theme];
  const need = xpForLevel(level);
  const pct = Math.min(100, (xp / need) * 100);
  const unlocked = achievements.filter((a) => a.unlocked).length;

  // Flash the XP bar briefly whenever it grows.
  const prevXp = useRef(xp);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (xp !== prevXp.current) {
      prevXp.current = xp;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 420);
      return () => clearTimeout(t);
    }
  }, [xp]);

  const visible = phase === 'PLAYING' && activeModal === null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute inset-0 z-30 select-none"
        >
          {/* ------------------------------------------------------- TOP LEFT */}
          <div className="pointer-events-auto absolute left-3 top-3 sm:left-5 sm:top-5">
            <div className="glass clip-cyber flex items-center gap-3 p-2.5 pr-4 sm:gap-4">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-sm font-black text-void-950 sm:h-12 sm:w-12"
                style={{
                  background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
                  boxShadow: `0 0 22px ${palette.glow}`,
                }}
              >
                {level}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-[11px] font-bold tracking-[0.16em] text-white/90">
                    {portfolio.identity.callsign}
                  </span>
                  {showFps && <FpsMeter />}
                </div>

                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10 sm:w-40">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${palette.primary}, ${palette.accent})`,
                        boxShadow: flash ? `0 0 14px ${palette.primary}` : 'none',
                      }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                    />
                  </div>
                  <span className="hidden font-mono text-[10px] tabular-nums text-slate-400 sm:inline">
                    {xp}/{need}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------ TOP RIGHT */}
          <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 sm:right-5 sm:top-5">
            <div className="glass clip-tag mr-1 hidden items-center gap-2 px-3 py-2 sm:flex">
              <Gem className="h-4 w-4 text-neon-amber" />
              <span className="font-mono text-xs font-bold tabular-nums text-neon-amber">
                {cores}/5
              </span>
            </div>

            <IconButton onClick={() => openModal('achievements')} label="Achievements">
              <div className="relative">
                <Trophy className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                {unlocked > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-amber px-1 font-mono text-[9px] font-black text-void-950">
                    {unlocked}
                  </span>
                )}
              </div>
            </IconButton>

            {!touch && (
              <IconButton onClick={() => openModal('console')} label="Terminal (`)">
                <Terminal style={{ width: 18, height: 18 }} />
              </IconButton>
            )}

            <IconButton onClick={toggleSfx} label={sfxEnabled ? 'Mute' : 'Unmute'}>
              {sfxEnabled ? (
                <Volume2 style={{ width: 18, height: 18 }} />
              ) : (
                <VolumeX style={{ width: 18, height: 18 }} />
              )}
            </IconButton>

            <IconButton onClick={togglePause} label="Pause (Esc)" accent>
              <Pause style={{ width: 18, height: 18 }} />
            </IconButton>
          </div>

          {/* -------------------------------------------- CENTRE: INTERACTION */}
          <div className="absolute inset-x-0 bottom-[24%] flex justify-center px-4 sm:bottom-[26%]">
            <AnimatePresence mode="wait">
              {nearby && (
                <motion.div
                  key={nearby.id}
                  initial={{ opacity: 0, y: 18, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  className="glass-strong clip-cyber flex items-center gap-3 px-5 py-3.5"
                  style={{ borderColor: `${nearby.color}80`, boxShadow: `0 0 34px ${nearby.color}30` }}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-black text-void-950"
                    style={{ background: nearby.color }}
                  >
                    {touch ? '↑' : 'E'}
                  </span>
                  <div className="text-left">
                    <div
                      className="font-display text-sm font-black tracking-wide"
                      style={{ color: nearby.color }}
                    >
                      {nearby.prompt}
                    </div>
                    <div className="font-mono text-[10px] tracking-[0.16em] text-slate-400">
                      {nearby.name}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ---------------------------------------------------- BOTTOM LEFT */}
          {/* Lifted clear of the virtual joystick on touch layouts, which sits
              in the same bottom-left corner below the md breakpoint. */}
          <div
            className={`pointer-events-auto absolute left-3 max-w-[70vw] sm:left-5 sm:max-w-xs ${
              touch ? 'bottom-48 md:bottom-5' : 'bottom-3 sm:bottom-5'
            }`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={quest?.id ?? 'complete'}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.35 }}
                className="glass clip-cyber border-l-2 p-3.5 sm:p-4"
                style={{ borderLeftColor: palette.accent }}
              >
                <div
                  className="flex items-center gap-1.5 font-display text-[9px] font-bold tracking-[0.28em]"
                  style={{ color: palette.accent }}
                >
                  <Target className="h-3 w-3" />
                  {quest ? 'OBJECTIVE' : 'ALL OBJECTIVES COMPLETE'}
                </div>

                {quest ? (
                  <>
                    <div className="mt-1.5 font-display text-[13px] font-bold leading-tight text-white">
                      {quest.title}
                    </div>
                    <div className="mt-1 text-xs leading-snug text-slate-400">
                      {quest.description}
                    </div>
                  </>
                ) : (
                  <div className="mt-1.5 text-xs leading-snug text-slate-300">
                    You have seen the whole city. Find any remaining Data Cores, or open a channel.
                  </div>
                )}

                <div className="mt-2.5 flex items-center gap-1">
                  {quests.map((q) => (
                    <span key={q.id} title={q.title}>
                      {q.done ? (
                        <CheckCircle2 className="h-3 w-3" style={{ color: palette.primary }} />
                      ) : (
                        <Circle className="h-3 w-3 text-slate-600" />
                      )}
                    </span>
                  ))}
                  <span className="ml-1 font-mono text-[9px] text-slate-500">
                    {quests.filter((q) => q.done).length}/{quests.length}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* --------------------------------------------------- BOTTOM RIGHT */}
          <div className="pointer-events-auto absolute bottom-3 right-3 hidden sm:bottom-5 sm:right-5 md:block">
            <Minimap />
            <div className="glass clip-tag mt-2 flex items-center justify-center gap-2 px-3 py-2 font-mono text-[10px] text-slate-400">
              <span className="kbd">WASD</span> move
              <span className="kbd">SHIFT</span> run
              <span className="kbd">SPACE</span> jump
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
