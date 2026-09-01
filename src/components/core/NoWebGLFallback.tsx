import React from 'react';
import { motion } from 'framer-motion';
import { MonitorX, User, Box, Briefcase, Award, FileText, Radio, Cpu } from 'lucide-react';
import { portfolio } from '../../config/portfolio';
import { useGameStore } from '../../store/useGameStore';
import { ModalId } from '../../types/game';

const SECTIONS: { id: ModalId; label: string; icon: typeof User; color: string }[] = [
  { id: 'projects', label: 'PROJECTS', icon: Cpu, color: '#22d3ee' },
  { id: 'about', label: 'ABOUT', icon: User, color: '#38bdf8' },
  { id: 'skills', label: 'SKILLS', icon: Box, color: '#a855f7' },
  { id: 'experience', label: 'EXPERIENCE', icon: Briefcase, color: '#34d399' },
  { id: 'credentials', label: 'CREDENTIALS', icon: Award, color: '#fbbf24' },
  { id: 'resume', label: 'RESUME', icon: FileText, color: '#60a5fa' },
  { id: 'contact', label: 'CONTACT', icon: Radio, color: '#f472b6' },
];

/**
 * Shown when WebGL is unavailable or the 3D context is lost. The portfolio
 * content itself is DOM, so everything except the city remains usable.
 */
export const NoWebGLFallback: React.FC<{ reason: 'unsupported' | 'lost' }> = ({ reason }) => {
  const openModal = useGameStore((s) => s.openModal);
  const { identity } = portfolio;

  return (
    <div className="scanlines absolute inset-0 z-[95] overflow-y-auto bg-void-950">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="clip-tag mb-8 inline-flex items-center gap-2 border border-neon-amber/35 bg-neon-amber/10 px-4 py-2">
          <MonitorX className="h-4 w-4 text-neon-amber" />
          <span className="font-mono text-[10px] tracking-[0.18em] text-neon-amber">
            {reason === 'lost' ? '3D CONTEXT LOST' : '3D MODE UNAVAILABLE'}
          </span>
        </div>

        <h1 className="font-display text-4xl font-black leading-tight sm:text-6xl">
          <span className="bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
            {identity.name}
          </span>
        </h1>
        <p className="mt-2 font-display text-xs font-bold tracking-[0.28em] text-neon-cyan/85 sm:text-sm">
          {identity.title.toUpperCase()}
        </p>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
          {identity.tagline}
        </p>

        <p className="mt-6 max-w-xl text-sm leading-relaxed text-slate-500">
          {reason === 'lost'
            ? 'The 3D view stopped unexpectedly — usually a GPU driver hiccup. Reload to try the city again, or browse the full portfolio below.'
            : 'This browser or device does not support the WebGL features the 3D city needs. The complete portfolio is available below.'}
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => openModal(s.id)}
              className="clip-tag group flex items-center gap-3.5 border border-white/[0.08] bg-white/[0.025] p-4 text-left transition hover:bg-white/[0.06]"
              style={{ borderColor: `${s.color}25` }}
            >
              <s.icon className="h-5 w-5 shrink-0 transition" style={{ color: s.color }} />
              <span className="font-display text-sm font-bold tracking-[0.12em] text-slate-200">
                {s.label}
              </span>
            </motion.button>
          ))}
        </div>

        <button
          onClick={() => window.location.reload()}
          className="clip-tag mt-8 border border-white/15 px-5 py-3 font-display text-[11px] font-bold tracking-[0.16em] text-slate-400 transition hover:border-neon-cyan/60 hover:text-neon-cyan"
        >
          RELOAD AND RETRY 3D
        </button>
      </div>
    </div>
  );
};
