import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Globe2 } from 'lucide-react';

import { useGameStore, THEMES } from '../../store/useGameStore';
import { WORLDS, type WorldId } from '../../config/worlds';
import { audio } from '../../utils/audioSynth';

/* ---------------------------------------------------------------------------
 * "Which world would you like to explore?"
 *
 * Sits between the start screen and the opening cinematic. The 3D scene is
 * already live behind this, rendering whichever world is highlighted, so the
 * cards are a caption for something the visitor can actually see rather than a
 * promise about it. Highlighting a card swaps the world underneath
 * immediately.
 *
 * Every world uses the same layout and the same content, so this is a purely
 * cosmetic choice and nothing here can put the visitor somewhere broken.
 * ------------------------------------------------------------------------- */

export const WorldSelect: React.FC = () => {
  const worldId = useGameStore((s) => s.worldId);
  const previewWorld = useGameStore((s) => s.previewWorld);
  const chooseWorld = useGameStore((s) => s.chooseWorld);
  const theme = useGameStore((s) => s.theme);

  const palette = THEMES[theme];
  const selected = useMemo(() => WORLDS.find((w) => w.id === worldId) ?? WORLDS[0], [worldId]);

  /* Give the scene a beat to swap its shaders before the cards fade in, so the
     first thing anyone sees is not a half-built world. */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 220);
    return () => window.clearTimeout(id);
  }, []);

  const commit = (id: WorldId) => chooseWorld(id);

  /* Arrow keys to browse, Enter to go. Anyone who reaches for the keyboard
     here is about to spend the whole visit using it. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const index = WORLDS.findIndex((w) => w.id === worldId);

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        previewWorld(WORLDS[(index + 1) % WORLDS.length].id);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        previewWorld(WORLDS[(index - 1 + WORLDS.length) % WORLDS.length].id);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        commit(worldId);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // re-bound each render so it always sees the current selection

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="safe-area absolute z-[80] flex flex-col justify-between overflow-hidden"
    >
      {/* Scrims top and bottom only, so the middle of the screen stays clear
          and the world itself is the background. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-void-950 via-void-950/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-void-950 via-void-950/85 to-transparent" />

      {/* ------------------------------------------------------------ title */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : -14 }}
        transition={{ duration: 0.5 }}
        className="relative px-6 pt-8 text-center sm:pt-12"
      >
        <div
          className="flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.4em]"
          style={{ color: palette.primary }}
        >
          <Globe2 className="h-3 w-3" />
          DESTINATION
        </div>
        <h1 className="mt-3 font-display text-2xl font-black tracking-[0.06em] text-white sm:text-4xl">
          CHOOSE YOUR WORLD
        </h1>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400 sm:text-sm">
          The same city, the same story. Only the scenery changes.
        </p>
      </motion.div>

      {/* ------------------------------------------------------------- cards */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 24 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="relative px-4 pb-6 sm:px-8 sm:pb-10"
      >
        {/* Description of whatever is currently highlighted. */}
        <div className="mx-auto mb-4 min-h-[3.5rem] max-w-xl text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={selected.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="text-xs leading-relaxed text-slate-300 sm:text-sm"
            >
              {selected.description}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Scrolls sideways on a phone; wraps on anything wider, so the row
            keeps working however many worlds end up in the registry. */}
        <div className="mx-auto flex max-w-5xl snap-x gap-3 overflow-x-auto pb-2 sm:flex-wrap sm:justify-center sm:gap-3 sm:overflow-visible">
          {WORLDS.map((world) => {
            const active = world.id === worldId;
            return (
              <button
                key={world.id}
                onClick={() => (active ? commit(world.id) : previewWorld(world.id))}
                onMouseEnter={() => previewWorld(world.id)}
                onFocus={() => previewWorld(world.id)}
                aria-pressed={active}
                aria-label={`${world.name} — ${world.tagline}`}
                className={`group relative w-[62vw] shrink-0 snap-center overflow-hidden rounded-xl border text-left transition-all duration-300 sm:w-44 ${
                  active
                    ? 'scale-[1.03] border-white/40 shadow-2xl'
                    : 'border-white/10 opacity-60 hover:opacity-100'
                }`}
              >
                {/* A stripe of the world's own colours, so each card reads as
                    that place before the 3D behind it has even been seen. */}
                <div
                  className="h-20 w-full sm:h-20"
                  style={{
                    background: `linear-gradient(150deg, ${world.swatch[0]} 0%, ${world.swatch[1]} 62%, ${world.swatch[2]} 100%)`,
                  }}
                />
                {active && (
                  <span
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-void-950"
                    style={{ background: world.swatch[2] }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}

                <div className="bg-void-950/80 px-3 py-2.5 backdrop-blur-sm">
                  <div className="font-display text-[12px] font-black tracking-[0.14em] text-white">
                    {world.name}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[9px] tracking-[0.1em] text-slate-400">
                    {world.tagline}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* --------------------------------------------------------- confirm */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            onClick={() => commit(worldId)}
            onMouseEnter={() => audio.uiHover()}
            className="clip-cyber group flex items-center gap-3 px-8 py-3.5 font-display text-sm font-black tracking-[0.2em] text-void-950 transition hover:scale-[1.03]"
            style={{
              background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
              boxShadow: `0 0 30px ${palette.glow}`,
            }}
          >
            EXPLORE {selected.name}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </button>

          <div className="hidden font-mono text-[10px] tracking-[0.18em] text-slate-500 sm:block">
            <span className="kbd">&larr;</span> <span className="kbd">&rarr;</span> to browse
            <span className="mx-2 text-slate-700">|</span>
            <span className="kbd">ENTER</span> to begin
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WorldSelect;
