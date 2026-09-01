import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Lock, Check } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { useGameStore, xpForLevel } from '../../store/useGameStore';

export const AchievementsModal: React.FC = () => {
  const achievements = useGameStore((s) => s.achievements);
  const level = useGameStore((s) => s.level);
  const xp = useGameStore((s) => s.xp);
  const totalXp = useGameStore((s) => s.totalXp);

  const unlocked = achievements.filter((a) => a.unlocked).length;
  const pct = Math.round((unlocked / achievements.length) * 100);

  return (
    <ModalShell
      accent="#fbbf24"
      icon={<Trophy className="h-5 w-5" />}
      title="ACHIEVEMENTS"
      subtitle={`${unlocked} OF ${achievements.length} UNLOCKED`}
      width="max-w-3xl"
    >
      {/* Summary strip */}
      <div className="clip-cyber mb-6 grid grid-cols-2 gap-px overflow-hidden border border-white/[0.08] bg-white/[0.05] sm:grid-cols-4">
        {[
          ['LEVEL', level],
          ['CURRENT XP', `${xp}/${xpForLevel(level)}`],
          ['TOTAL XP', totalXp],
          ['COMPLETION', `${pct}%`],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-void-950/90 p-4 text-center">
            <div className="font-mono text-[9px] tracking-[0.2em] text-slate-500">{label}</div>
            <div className="mt-1 font-display text-lg font-black tabular-nums text-neon-amber">
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Overall bar */}
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-neon-amber to-neon-pink"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {achievements.map((a, i) => {
          const concealed = a.hidden && !a.unlocked;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`clip-tag flex items-start gap-3.5 border p-4 transition ${
                a.unlocked
                  ? 'border-neon-amber/30 bg-neon-amber/[0.07]'
                  : 'border-white/[0.07] bg-white/[0.02]'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  a.unlocked ? 'bg-neon-amber/20 text-neon-amber' : 'bg-white/[0.05] text-slate-600'
                }`}
              >
                {a.unlocked ? <Check className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className={`font-display text-[13px] font-black ${
                    a.unlocked ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {concealed ? '???' : a.name}
                </div>
                <div className="mt-0.5 text-xs leading-snug text-slate-500">
                  {concealed ? 'Hidden achievement' : a.description}
                </div>
              </div>

              <div
                className={`shrink-0 font-mono text-[10px] font-bold tabular-nums ${
                  a.unlocked ? 'text-neon-amber' : 'text-slate-700'
                }`}
              >
                +{a.xp}
              </div>
            </motion.div>
          );
        })}
      </div>
    </ModalShell>
  );
};
