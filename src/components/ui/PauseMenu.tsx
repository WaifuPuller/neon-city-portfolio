import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Settings2,
  Home,
  Volume2,
  VolumeX,
  Music,
  Monitor,
  Gauge,
  Palette,
  MousePointer2,
  X,
  RotateCcw,
} from 'lucide-react';
import { useGameStore, THEMES } from '../../store/useGameStore';
import { QualityLevel, ThemeId } from '../../types/game';
import { audio } from '../../utils/audioSynth';

const QUALITY_LABELS: Record<QualityLevel, string> = {
  ultra: 'ULTRA — shadows, bloom, full particles',
  high: 'HIGH — shadows and bloom',
  medium: 'MEDIUM — bloom only',
  low: 'LOW — mobile optimised',
};

const Row: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({
  icon,
  label,
  children,
}) => (
  <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-3.5 last:border-0">
    <div className="flex min-w-0 items-center gap-2.5 text-slate-300">
      <span className="text-slate-500">{icon}</span>
      <span className="truncate font-display text-[11px] font-bold tracking-[0.14em]">{label}</span>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const Toggle: React.FC<{ on: boolean; onClick: () => void; labels?: [string, string] }> = ({
  on,
  onClick,
  labels = ['OFF', 'ON'],
}) => (
  <button
    onClick={onClick}
    role="switch"
    aria-checked={on}
    className={`clip-tag flex h-8 w-[86px] items-center justify-center font-mono text-[10px] font-bold tracking-[0.14em] transition ${
      on
        ? 'bg-neon-cyan/20 text-neon-cyan ring-1 ring-inset ring-neon-cyan/50'
        : 'bg-white/[0.05] text-slate-500 ring-1 ring-inset ring-white/10'
    }`}
  >
    {on ? labels[1] : labels[0]}
  </button>
);

/** Settings body, shared by the pause screen and the standalone settings modal. */
export const SettingsPanel: React.FC = () => {
  const quality = useGameStore((s) => s.quality);
  const theme = useGameStore((s) => s.theme);
  const sfxEnabled = useGameStore((s) => s.sfxEnabled);
  const musicEnabled = useGameStore((s) => s.musicEnabled);
  const masterVolume = useGameStore((s) => s.masterVolume);
  const invertY = useGameStore((s) => s.invertY);
  const sensitivity = useGameStore((s) => s.mouseSensitivity);
  const showFps = useGameStore((s) => s.showFps);

  const setQuality = useGameStore((s) => s.setQuality);
  const setTheme = useGameStore((s) => s.setTheme);
  const toggleSfx = useGameStore((s) => s.toggleSfx);
  const toggleMusic = useGameStore((s) => s.toggleMusic);
  const setMasterVolume = useGameStore((s) => s.setMasterVolume);
  const setInvertY = useGameStore((s) => s.setInvertY);
  const setMouseSensitivity = useGameStore((s) => s.setMouseSensitivity);
  const toggleFps = useGameStore((s) => s.toggleFps);

  return (
    <div className="text-left">
      <Row icon={<Gauge className="h-4 w-4" />} label="GRAPHICS">
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as QualityLevel)}
          className="clip-tag w-[190px] cursor-pointer border-0 bg-white/[0.06] px-3 py-2 font-mono text-[10px] text-neon-cyan outline-none ring-1 ring-inset ring-white/10"
        >
          {(Object.keys(QUALITY_LABELS) as QualityLevel[]).map((q) => (
            <option key={q} value={q} className="bg-void-900 text-slate-200">
              {QUALITY_LABELS[q]}
            </option>
          ))}
        </select>
      </Row>

      <Row icon={<Palette className="h-4 w-4" />} label="NEON THEME">
        <div className="flex gap-1.5">
          {(Object.keys(THEMES) as ThemeId[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              title={THEMES[t].label}
              aria-label={`Theme ${THEMES[t].label}`}
              className={`h-8 w-8 rounded-lg border-2 transition ${
                theme === t ? 'scale-110 border-white' : 'border-white/20 hover:border-white/50'
              }`}
              style={{ background: THEMES[t].primary }}
            />
          ))}
        </div>
      </Row>

      <Row icon={<Volume2 className="h-4 w-4" />} label="SOUND EFFECTS">
        <Toggle on={sfxEnabled} onClick={toggleSfx} />
      </Row>

      <Row icon={<Music className="h-4 w-4" />} label="MUSIC">
        <Toggle on={musicEnabled} onClick={toggleMusic} />
      </Row>

      <Row icon={sfxEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} label="MASTER VOLUME">
        <div className="flex w-[190px] items-center gap-2.5">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-cyan-400"
            aria-label="Master volume"
          />
          <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-slate-400">
            {Math.round(masterVolume * 100)}
          </span>
        </div>
      </Row>

      <Row icon={<MousePointer2 className="h-4 w-4" />} label="LOOK SENSITIVITY">
        <div className="flex w-[190px] items-center gap-2.5">
          <input
            type="range"
            min={0.3}
            max={2.5}
            step={0.1}
            value={sensitivity}
            onChange={(e) => setMouseSensitivity(parseFloat(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-cyan-400"
            aria-label="Look sensitivity"
          />
          <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-slate-400">
            {sensitivity.toFixed(1)}
          </span>
        </div>
      </Row>

      <Row icon={<MousePointer2 className="h-4 w-4" />} label="INVERT Y AXIS">
        <Toggle on={invertY} onClick={() => setInvertY(!invertY)} />
      </Row>

      <Row icon={<Monitor className="h-4 w-4" />} label="FPS COUNTER">
        <Toggle on={showFps} onClick={toggleFps} />
      </Row>
    </div>
  );
};

/* -------------------------------------------------------------- pause screen */

export const PauseMenu: React.FC = () => {
  const phase = useGameStore((s) => s.phase);
  const togglePause = useGameStore((s) => s.togglePause);
  const resetRun = useGameStore((s) => s.resetRun);
  const [showSettings, setShowSettings] = React.useState(false);

  React.useEffect(() => {
    if (phase !== 'PAUSED') setShowSettings(false);
  }, [phase]);

  return (
    <AnimatePresence>
      {phase === 'PAUSED' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-void-950/85 p-4 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.94, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="glass-strong clip-cyber flex max-h-[90vh] w-full max-w-lg flex-col"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] p-5">
              <h2 className="font-display text-xl font-black tracking-[0.16em] text-neon-cyan neon-text">
                {showSettings ? 'SETTINGS' : 'PAUSED'}
              </h2>
              <button
                onClick={showSettings ? () => setShowSettings(false) : togglePause}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 text-slate-400 transition hover:border-neon-pink/60 hover:text-neon-pink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {showSettings ? (
                <SettingsPanel />
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={togglePause}
                    onMouseEnter={() => audio.uiHover()}
                    className="clip-tag flex w-full items-center justify-center gap-2.5 bg-gradient-to-r from-neon-cyan to-neon-blue px-6 py-4 font-display text-sm font-black tracking-[0.14em] text-void-950 transition hover:brightness-110"
                  >
                    <Play className="h-4 w-4 fill-current" /> RESUME
                  </button>

                  <button
                    onClick={() => {
                      audio.uiClick();
                      setShowSettings(true);
                    }}
                    onMouseEnter={() => audio.uiHover()}
                    className="clip-tag flex w-full items-center justify-center gap-2.5 border border-white/15 px-6 py-3.5 font-display text-xs font-bold tracking-[0.14em] text-slate-200 transition hover:border-neon-violet/60 hover:text-neon-violet"
                  >
                    <Settings2 className="h-4 w-4" /> SETTINGS
                  </button>

                  <button
                    onClick={() => {
                      audio.uiClick();
                      resetRun();
                    }}
                    onMouseEnter={() => audio.uiHover()}
                    className="clip-tag flex w-full items-center justify-center gap-2.5 border border-white/15 px-6 py-3.5 font-display text-xs font-bold tracking-[0.14em] text-slate-400 transition hover:border-neon-amber/60 hover:text-neon-amber"
                  >
                    <RotateCcw className="h-4 w-4" /> RESTART RUN
                  </button>

                  <button
                    onClick={() => {
                      audio.uiClick();
                      useGameStore.getState().setPhase('START');
                    }}
                    onMouseEnter={() => audio.uiHover()}
                    className="clip-tag flex w-full items-center justify-center gap-2.5 border border-white/15 px-6 py-3.5 font-display text-xs font-bold tracking-[0.14em] text-slate-400 transition hover:border-neon-pink/60 hover:text-neon-pink"
                  >
                    <Home className="h-4 w-4" /> MAIN MENU
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.07] px-5 py-3 text-center font-mono text-[10px] tracking-[0.2em] text-slate-600">
              ESC TO RESUME
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* --------------------------------------------- standalone settings (pre-game) */

export const SettingsModal: React.FC = () => {
  const closeModal = useGameStore((s) => s.closeModal);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeModal}
        aria-label="Close settings"
        className="absolute inset-0 cursor-default bg-void-950/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="glass-strong clip-cyber relative flex max-h-[88vh] w-full max-w-lg flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] p-5">
          <h2 className="flex items-center gap-2.5 font-display text-lg font-black tracking-[0.14em] text-neon-violet">
            <Settings2 className="h-5 w-5" /> SETTINGS
          </h2>
          <button
            onClick={closeModal}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 text-slate-400 transition hover:border-neon-pink/60 hover:text-neon-pink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <SettingsPanel />
        </div>

        <div className="border-t border-white/[0.07] p-4">
          <button
            onClick={closeModal}
            className="clip-tag w-full bg-neon-violet px-6 py-3.5 font-display text-xs font-black tracking-[0.14em] text-void-950 transition hover:brightness-110"
          >
            APPLY & CLOSE
          </button>
        </div>
      </motion.div>
    </div>
  );
};
