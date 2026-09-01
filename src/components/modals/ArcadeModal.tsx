import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Trophy, RotateCcw, Play, Zap } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { useGameStore } from '../../store/useGameStore';
import { audio } from '../../utils/audioSynth';

const GRID = 9;
const ROUND_SECONDS = 20;
const XP_PER_NODE = 45;

type Phase = 'ready' | 'playing' | 'over';

/**
 * "Neural Breach": hit the lit node before it moves. Decoys appear as the
 * score climbs, so it gets harder rather than just faster.
 */
export const ArcadeModal: React.FC = () => {
  const addXp = useGameStore((s) => s.addXp);
  const unlockAchievement = useGameStore((s) => s.unlockAchievement);

  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [target, setTarget] = useState(0);
  const [decoys, setDecoys] = useState<number[]>([]);
  const [shake, setShake] = useState(false);

  const scoreRef = useRef(0);
  scoreRef.current = score;

  const pickTargets = useCallback((currentScore: number) => {
    const next = Math.floor(Math.random() * GRID);
    setTarget(next);

    // One decoy per 4 points, capped so the board stays readable.
    const decoyCount = Math.min(3, Math.floor(currentScore / 4));
    const pool = Array.from({ length: GRID }, (_, i) => i).filter((i) => i !== next);
    const picked: number[] = [];
    for (let i = 0; i < decoyCount && pool.length > 0; i++) {
      picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
    }
    setDecoys(picked);
  }, []);

  /* Countdown. The updater stays pure — React invokes updaters twice under
     StrictMode, so awarding XP inside one would double every payout. */
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = window.setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  /* End of round, handled as an effect so the payout happens exactly once. */
  useEffect(() => {
    if (phase !== 'playing' || timeLeft > 0) return;

    const finalScore = scoreRef.current;
    setPhase('over');
    setBest((b) => Math.max(b, finalScore));
    if (finalScore > 0) addXp(finalScore * XP_PER_NODE, 'Neural Breach');
    if (finalScore >= 12) unlockAchievement('arcade-ace');
    audio.levelUp();
  }, [phase, timeLeft, addXp, unlockAchievement]);

  /* The target relocates on its own if left alone too long. */
  useEffect(() => {
    if (phase !== 'playing') return;
    const drift = window.setInterval(() => pickTargets(scoreRef.current), 1600);
    return () => window.clearInterval(drift);
  }, [phase, pickTargets]);

  const start = () => {
    audio.uiClick();
    setScore(0);
    setCombo(0);
    setTimeLeft(ROUND_SECONDS);
    setPhase('playing');
    pickTargets(0);
  };

  const hit = (index: number) => {
    if (phase !== 'playing') return;

    if (index === target) {
      audio.pickup();
      const next = score + 1;
      setScore(next);
      setCombo((c) => c + 1);
      pickTargets(next);
    } else {
      audio.error();
      setCombo(0);
      setShake(true);
      window.setTimeout(() => setShake(false), 240);
      // Missing costs a second rather than ending the run.
      setTimeLeft((t) => Math.max(1, t - 1));
    }
  };

  return (
    <ModalShell
      accent="#c084fc"
      icon={<Gamepad2 className="h-5 w-5" />}
      title="NEURAL BREACH"
      subtitle="ARCADE CABINET — SECTOR 07"
      width="max-w-md"
    >
      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="py-6 text-center"
          >
            <Zap className="mx-auto h-12 w-12 text-neon-violet" />
            <h3 className="mt-4 font-display text-xl font-black text-white">REACTION TEST</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
              Breach the glowing node before it relocates. Decoys light up dimly as your score
              climbs — hitting one costs you a second.
            </p>
            <div className="mt-4 font-mono text-[11px] tracking-[0.16em] text-neon-violet/80">
              {XP_PER_NODE} XP PER NODE · {ROUND_SECONDS}s ROUND
            </div>

            <button
              onClick={start}
              className="clip-tag mt-6 inline-flex w-full items-center justify-center gap-2 bg-neon-violet px-6 py-4 font-display text-sm font-black tracking-[0.14em] text-void-950 transition hover:brightness-110"
            >
              <Play className="h-4 w-4 fill-current" /> START BREACH
            </button>
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-4 flex items-center justify-between font-display text-xs font-bold">
              <span className="text-neon-violet">
                SCORE <span className="tabular-nums text-white">{score}</span>
              </span>
              {combo >= 3 && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="font-mono text-[11px] text-neon-amber"
                >
                  ×{combo} COMBO
                </motion.span>
              )}
              <span className={timeLeft <= 5 ? 'text-neon-red' : 'text-neon-cyan'}>
                <span className="tabular-nums">{timeLeft}</span>s
              </span>
            </div>

            {/* Timer bar */}
            <div className="mb-5 h-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-neon-violet to-neon-pink"
                animate={{ width: `${(timeLeft / ROUND_SECONDS) * 100}%` }}
                transition={{ duration: 0.9, ease: 'linear' }}
              />
            </div>

            <motion.div
              animate={shake ? { x: [0, -7, 7, -4, 0] } : { x: 0 }}
              transition={{ duration: 0.24 }}
              className="grid grid-cols-3 gap-2.5"
            >
              {Array.from({ length: GRID }, (_, i) => {
                const isTarget = i === target;
                const isDecoy = decoys.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => hit(i)}
                    className={`clip-tag aspect-square transition-all duration-150 ${
                      isTarget
                        ? 'scale-[1.04] border-2 border-neon-violet bg-neon-violet/80 shadow-[0_0_28px_rgba(192,132,252,0.6)]'
                        : isDecoy
                        ? 'border border-neon-violet/30 bg-neon-violet/10'
                        : 'border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                    aria-label={isTarget ? 'Active node' : 'Inactive node'}
                  >
                    {isTarget && (
                      <span className="font-display text-lg font-black text-void-950">⚡</span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        )}

        {phase === 'over' && (
          <motion.div
            key="over"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-8 text-center"
          >
            <Trophy className="mx-auto h-14 w-14 text-neon-amber" />
            <h3 className="mt-4 font-display text-2xl font-black text-neon-amber">
              BREACH COMPLETE
            </h3>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ['NODES', score],
                ['XP', score * XP_PER_NODE],
                ['BEST', Math.max(best, score)],
              ].map(([label, value]) => (
                <div key={label} className="clip-tag border border-white/[0.08] bg-white/[0.03] p-3">
                  <div className="font-mono text-[9px] tracking-[0.2em] text-slate-500">{label}</div>
                  <div className="mt-0.5 font-display text-lg font-black tabular-nums text-white">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {score < 12 && (
              <p className="mt-4 font-mono text-[11px] text-slate-500">
                Reach 12 nodes to unlock the Neural Ace achievement.
              </p>
            )}

            <button
              onClick={start}
              className="clip-tag mt-6 inline-flex w-full items-center justify-center gap-2 bg-neon-violet px-6 py-4 font-display text-sm font-black tracking-[0.14em] text-void-950 transition hover:brightness-110"
            >
              <RotateCcw className="h-4 w-4" /> RUN AGAIN
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalShell>
  );
};
