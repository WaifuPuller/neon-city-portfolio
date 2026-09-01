import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

interface Props {
  accent: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Tailwind max-width class. */
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Shared frame for every content panel: backdrop, focus trap, escape handling,
 * scroll containment and the entrance animation.
 */
export const ModalShell: React.FC<Props> = ({
  accent,
  icon,
  title,
  subtitle,
  width = 'max-w-4xl',
  children,
  footer,
}) => {
  const closeModal = useGameStore((s) => s.closeModal);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      // Keep tabbing inside the dialog.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused.current?.focus?.();
    };
  }, [closeModal]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-5">
      {/* Backdrop */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeModal}
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-void-950/80 backdrop-blur-md"
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`glass-strong clip-cyber relative flex max-h-[92vh] w-full flex-col outline-none sm:max-h-[88vh] ${width}`}
        style={{ borderColor: `${accent}55`, boxShadow: `0 0 70px -12px ${accent}45` }}
      >
        {/* Accent rail */}
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: `${accent}55`, background: `${accent}18`, color: accent }}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <h2
                className="truncate font-display text-lg font-black tracking-wide sm:text-xl"
                style={{ color: accent }}
              >
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 truncate font-mono text-[10px] tracking-[0.16em] text-slate-500">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={closeModal}
            aria-label="Close panel"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 text-slate-400 transition hover:border-neon-pink/60 hover:text-neon-pink"
          >
            <X className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Body */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6"
          data-selectable
        >
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-white/[0.07] p-4 sm:px-6">{footer}</div>
        )}

        {/* Escape hint */}
        <div className="pointer-events-none absolute -bottom-6 left-1/2 hidden -translate-x-1/2 font-mono text-[10px] tracking-[0.2em] text-white/25 sm:block">
          PRESS ESC TO RETURN TO THE CITY
        </div>
      </motion.div>
    </div>
  );
};

/* ------------------------------------------------------------ small helpers */

export const Tag: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = '#94a3b8',
}) => (
  <span
    className="clip-tag inline-block px-2 py-1 font-mono text-[10px] font-bold tracking-wide"
    style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}
  >
    {children}
  </span>
);

export const SectionLabel: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = '#64748b',
}) => (
  <div
    className="mb-3 font-display text-[9px] font-bold tracking-[0.3em]"
    style={{ color }}
  >
    {children}
  </div>
);
