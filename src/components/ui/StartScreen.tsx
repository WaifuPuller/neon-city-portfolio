import React from 'react';
import { motion } from 'framer-motion';
import { Play, Settings2, Gamepad2, MousePointer2, Smartphone, Loader2 } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { portfolio } from '../../config/portfolio';
import { audio } from '../../utils/audioSynth';
import { SocialLinks } from './SocialLinks';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

interface Props {
  touch: boolean;
  /** True once the 3D engine has rendered its first frame. */
  ready: boolean;
  /** 0..100, used for the thin bar under the button while loading. */
  progress: number;
}

export const StartScreen: React.FC<Props> = ({ touch, ready, progress }) => {
  const beginGame = useGameStore((s) => s.beginGame);
  const openModal = useGameStore((s) => s.openModal);
  const { identity } = portfolio;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="scanlines absolute inset-0 z-[90] flex flex-col overflow-y-auto bg-gradient-to-b from-void-950/95 via-void-950/88 to-void-950/98"
    >
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(34,211,238,0.16),transparent_60%)]" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-8">
        {/* Availability pill */}
        <motion.div variants={item}>
          <div className="clip-tag inline-flex items-center gap-2 border border-neon-cyan/35 bg-neon-cyan/10 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-mint opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-mint" />
            </span>
            <span className="font-display text-[10px] font-bold tracking-[0.28em] text-neon-cyan">
              {identity.availability.toUpperCase()}
            </span>
          </div>
        </motion.div>

        {/* Name */}
        <motion.h1
          variants={item}
          className="mt-7 font-display text-[13vw] font-black leading-[0.86] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
        >
          <span className="bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
            {identity.name.split(' ')[0]}
          </span>{' '}
          <span className="bg-gradient-to-br from-neon-cyan via-neon-violet to-neon-pink bg-clip-text text-transparent">
            {identity.name.split(' ').slice(1).join(' ')}
          </span>
        </motion.h1>

        <motion.div
          variants={item}
          className="mt-4 font-display text-[11px] font-bold tracking-[0.4em] text-neon-cyan/85 sm:text-sm"
        >
          {identity.title.toUpperCase()}
        </motion.div>

        <motion.p
          variants={item}
          className="mt-6 max-w-xl text-base leading-relaxed text-slate-300/90 sm:text-lg"
        >
          {identity.tagline}
        </motion.p>

        {/* Primary actions. The page paints long before the 3D engine has
            finished streaming, so the button reports its own readiness rather
            than making the visitor stare at a loading screen. */}
        <motion.div variants={item} className="mt-10 flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <div className="w-full max-w-xs sm:w-auto">
            <button
              onClick={beginGame}
              disabled={!ready}
              onMouseEnter={() => ready && audio.uiHover()}
              className={`clip-cyber group relative flex w-full items-center justify-center gap-3 px-8 py-5 font-display text-base font-black tracking-wider text-void-950 transition-transform duration-200 sm:w-auto ${
                ready
                  ? 'ring-spin bg-gradient-to-r from-neon-cyan to-neon-blue hover:scale-[1.03] active:scale-[0.98]'
                  : 'cursor-wait bg-slate-700/70 text-slate-300'
              }`}
            >
              {ready ? (
                <>
                  <Play className="h-5 w-5 fill-current" />
                  ENTER THE CITY
                </>
              ) : (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  BUILDING THE CITY
                </>
              )}
            </button>

            {!ready && (
              <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-neon-cyan"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.35 }}
                />
              </div>
            )}
          </div>

          <button
            onClick={() => openModal('settings')}
            onMouseEnter={() => audio.uiHover()}
            className="clip-cyber flex w-full max-w-xs items-center justify-center gap-2 border border-white/20 bg-white/[0.04] px-7 py-5 font-display text-sm font-bold tracking-wider text-slate-200 transition hover:border-neon-violet hover:text-neon-violet sm:w-auto"
          >
            <Settings2 className="h-4 w-4" />
            SETTINGS
          </button>
        </motion.div>

        {/* Skip straight to the content for anyone who does not want to play */}
        <motion.button
          variants={item}
          onClick={() => openModal('projects')}
          className="mt-5 font-mono text-[11px] tracking-[0.18em] text-slate-500 underline-offset-4 transition hover:text-neon-cyan hover:underline"
        >
          Skip the game — view projects directly
        </motion.button>

        {/* Controls legend */}
        <motion.div
          variants={item}
          className="mt-12 grid w-full max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-4"
        >
          {(touch
            ? ([
                ['DRAG', 'Look'],
                ['STICK', 'Move'],
                ['TAP', 'Interact'],
                ['BTN', 'Jump'],
              ] as const)
            : ([
                ['WASD', 'Move'],
                ['MOUSE', 'Look'],
                ['SHIFT', 'Sprint'],
                ['E', 'Interact'],
              ] as const)
          ).map(([key, label]) => (
            <div
              key={key}
              className="glass clip-tag flex items-center justify-center gap-2 px-3 py-2.5"
            >
              <span className="kbd">{key}</span>
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* Device hint */}
        <motion.div
          variants={item}
          className="mt-5 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-slate-600"
        >
          {touch ? (
            <>
              <Smartphone className="h-3.5 w-3.5" /> TOUCH CONTROLS ENABLED
            </>
          ) : (
            <>
              <MousePointer2 className="h-3.5 w-3.5" /> CLICK THE VIEW TO CAPTURE THE MOUSE
            </>
          )}
        </motion.div>

        {/* Socials — driven entirely by the `socials` array in the config */}
        <motion.div variants={item} className="mt-9">
          <SocialLinks includeEmail />
        </motion.div>
      </div>

      {/* Footer strip */}
      <motion.div
        variants={item}
        className="relative flex items-center justify-center gap-2 border-t border-white/[0.06] px-6 py-4 font-mono text-[10px] tracking-[0.2em] text-slate-600"
      >
        <Gamepad2 className="h-3.5 w-3.5" />
        A PLAYABLE PORTFOLIO — BUILT WITH REACT THREE FIBER
      </motion.div>
    </motion.div>
  );
};
