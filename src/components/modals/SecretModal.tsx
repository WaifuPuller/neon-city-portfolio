import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Lock, Sparkles, Gem } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { portfolio } from '../../config/portfolio';
import { useGameStore, selectCoreCount } from '../../store/useGameStore';

export const SecretModal: React.FC = () => {
  const cores = useGameStore(selectCoreCount);
  const collectibles = useGameStore((s) => s.collectibles);
  const locked = cores < 5;

  return (
    <ModalShell
      accent={locked ? '#64748b' : '#ef4444'}
      icon={locked ? <Lock className="h-5 w-5" /> : <Flame className="h-5 w-5" />}
      title={locked ? 'SEALED VAULT' : portfolio.secret.title}
      subtitle={locked ? 'ACCESS DENIED' : 'CLEARANCE GRANTED'}
      width="max-w-2xl"
    >
      {locked ? (
        <div className="py-8 text-center">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 animate-pulse-ring rounded-full border border-slate-600" />
            <Lock className="h-12 w-12 text-slate-600" />
          </div>

          <h3 className="mt-6 font-display text-xl font-black text-slate-300">
            {5 - cores} DATA {5 - cores === 1 ? 'CORE' : 'CORES'} REMAINING
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            Five Data Cores are hidden around the city. Find them all and this vault opens.
          </p>

          {/* Core tracker */}
          <div className="mt-6 flex justify-center gap-2.5">
            {collectibles.map((c) => (
              <div
                key={c.id}
                title={c.collected ? c.name : 'Undiscovered'}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                  c.collected
                    ? 'border-neon-amber bg-neon-amber/15 text-neon-amber'
                    : 'border-white/10 bg-white/[0.03] text-slate-700'
                }`}
              >
                <Gem className="h-5 w-5" />
              </div>
            ))}
          </div>

          <p className="mt-6 font-mono text-[11px] tracking-[0.16em] text-slate-600">
            HINT: CHECK THE SIDE STREETS AND THE SOUTHERN PLAZA
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="clip-cyber relative overflow-hidden border border-neon-red/30 bg-gradient-to-br from-neon-red/12 via-transparent to-neon-amber/10 p-6 text-center">
            <div className="pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full bg-neon-red/25 blur-3xl" />
            <div className="relative">
              <Sparkles className="mx-auto h-10 w-10 text-neon-amber" />
              <h3 className="mt-3 font-display text-2xl font-black text-white">
                ALL CORES RECOVERED
              </h3>
              <p className="mt-1.5 font-mono text-[11px] tracking-[0.2em] text-neon-amber/80">
                100% EXPLORATION
              </p>
            </div>
          </div>

          <div className="clip-cyber mt-6 border border-white/[0.08] bg-black/40 p-5 font-mono text-sm leading-relaxed text-slate-300">
            <div className="mb-3 text-[10px] tracking-[0.24em] text-neon-red/70">
              {'>'} VAULT LOG — DECRYPTED
            </div>
            <p>{portfolio.secret.body}</p>
            <p className="mt-4 text-neon-cyan/80">
              — {portfolio.secret.signoff} {portfolio.identity.name}
            </p>
          </div>
        </motion.div>
      )}
    </ModalShell>
  );
};
