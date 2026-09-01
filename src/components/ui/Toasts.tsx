import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Zap,
  TrendingUp,
  Unlock,
  Target,
  Info,
  Footprints,
  ArrowUp,
  Cpu,
  Map,
  Gem,
  Building,
  Gamepad2,
  Terminal,
  Send,
  Flame,
  type LucideIcon,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

const ICONS: Record<string, LucideIcon> = {
  trophy: Trophy,
  zap: Zap,
  'trending-up': TrendingUp,
  unlock: Unlock,
  target: Target,
  footprints: Footprints,
  'arrow-up': ArrowUp,
  cpu: Cpu,
  map: Map,
  gem: Gem,
  building: Building,
  'gamepad-2': Gamepad2,
  terminal: Terminal,
  send: Send,
  flame: Flame,
};

const ACCENT: Record<string, { color: string; label: string }> = {
  achievement: { color: '#fbbf24', label: 'ACHIEVEMENT UNLOCKED' },
  xp: { color: '#22d3ee', label: 'EXPERIENCE' },
  quest: { color: '#34d399', label: 'OBJECTIVE' },
  info: { color: '#a855f7', label: 'SYSTEM' },
};

export const Toasts: React.FC = () => {
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none absolute left-1/2 top-20 z-[60] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 sm:top-24">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const accent = ACCENT[toast.kind] ?? ACCENT.info;
          const Icon = ICONS[toast.icon ?? ''] ?? Trophy;

          return (
            <motion.button
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -22, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.96, transition: { duration: 0.22 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={() => dismiss(toast.id)}
              className="glass-strong clip-cyber pointer-events-auto flex w-full items-center gap-3 p-3 text-left"
              style={{ borderColor: `${accent.color}66`, boxShadow: `0 0 32px ${accent.color}25` }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${accent.color}1f`, color: accent.color }}
              >
                <Icon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="font-display text-[8.5px] font-bold tracking-[0.24em]"
                  style={{ color: accent.color }}
                >
                  {accent.label}
                </div>
                <div className="truncate font-display text-sm font-black text-white">
                  {toast.title}
                </div>
                {toast.body && (
                  <div className="mt-0.5 truncate text-[11px] text-slate-400">{toast.body}</div>
                )}
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
