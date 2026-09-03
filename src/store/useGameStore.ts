import { create } from 'zustand';
import {
  Achievement,
  Collectible,
  GamePhase,
  ModalId,
  ModalType,
  NavTarget,
  QualityLevel,
  Quest,
  ThemeId,
  Vec3,
  Zone,
} from '../types/game';
import { COLLECTIBLES, QUEST_ZONES, ZONES } from '../systems/world';
import { audio } from '../utils/audioSynth';
import { detectQuality } from '../utils/device';

/* ------------------------------------------------------------------ themes */

export const THEMES: Record<
  ThemeId,
  { primary: string; secondary: string; accent: string; glow: string; label: string }
> = {
  cyan: { primary: '#22d3ee', secondary: '#3b82f6', accent: '#f472b6', glow: 'rgba(34,211,238,0.28)', label: 'ICE' },
  magenta: { primary: '#f472b6', secondary: '#a855f7', accent: '#22d3ee', glow: 'rgba(244,114,182,0.28)', label: 'NEON' },
  emerald: { primary: '#34d399', secondary: '#14b8a6', accent: '#fbbf24', glow: 'rgba(52,211,153,0.28)', label: 'TOXIC' },
  amber: { primary: '#fbbf24', secondary: '#f97316', accent: '#22d3ee', glow: 'rgba(251,191,36,0.28)', label: 'SOLAR' },
};

/* ------------------------------------------------------------ achievements */

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-steps', name: 'Boot Sequence', description: 'Take your first steps in the city.', icon: 'footprints', xp: 50, unlocked: false },
  { id: 'airborne', name: 'Airborne', description: 'Jump for the first time.', icon: 'arrow-up', xp: 25, unlocked: false },
  { id: 'sprinter', name: 'Overclocked', description: 'Sprint through the boulevard.', icon: 'zap', xp: 40, unlocked: false },
  { id: 'lab-visit', name: 'Lab Access', description: 'Enter the AI Research Lab.', icon: 'cpu', xp: 120, unlocked: false },
  { id: 'cartographer', name: 'Cartographer', description: 'Visit every landmark in the city.', icon: 'map', xp: 300, unlocked: false },
  { id: 'collector', name: 'Data Harvester', description: 'Collect all five Data Cores.', icon: 'gem', xp: 400, unlocked: false },
  { id: 'rooftop', name: 'High Ground', description: 'Stand on a rooftop.', icon: 'building', xp: 150, unlocked: false },
  { id: 'arcade-ace', name: 'Neural Ace', description: 'Score 12 or more in Neural Breach.', icon: 'gamepad-2', xp: 200, unlocked: false },
  { id: 'terminal', name: 'Root Access', description: 'Run a command in the terminal.', icon: 'terminal', xp: 100, unlocked: false, hidden: true },
  { id: 'signal', name: 'Signal Sent', description: 'Open a communication channel.', icon: 'send', xp: 150, unlocked: false },
  { id: 'vault', name: 'Vault Breaker', description: 'Breach the secret vault.', icon: 'flame', xp: 500, unlocked: false, hidden: true },
];

/* ------------------------------------------------------------------ quests */

/**
 * The quest chain is generated from the landmarks that actually exist, so a
 * portfolio with only projects and a contact form gets a two-step chain rather
 * than six steps pointing at buildings that were never built.
 */
const QUESTS: Quest[] = QUEST_ZONES.map((zone) => ({
  id: `q-${zone.id}`,
  title: zone.questTitle,
  description: zone.objective,
  done: false,
}));

/** Which quest a given panel completes, derived from the same source. */
const QUEST_FOR_MODAL: Partial<Record<ModalId, string>> = Object.fromEntries(
  QUEST_ZONES.map((zone) => [zone.modal, `q-${zone.id}`]),
) as Partial<Record<ModalId, string>>;

/** XP required to advance from the given level to the next. */
export const xpForLevel = (level: number) => 300 + (level - 1) * 260;

export interface Toast {
  id: number;
  kind: 'achievement' | 'xp' | 'quest' | 'info';
  title: string;
  body?: string;
  icon?: string;
}

export interface GameState {
  /* lifecycle */
  phase: GamePhase;
  loadProgress: number;
  activeModal: ModalType;
  introSkipped: boolean;

  /* settings */
  quality: QualityLevel;
  /** False once the visitor picks a level by hand; stops auto-adjustment. */
  qualityAuto: boolean;
  theme: ThemeId;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  masterVolume: number;
  invertY: boolean;
  mouseSensitivity: number;
  showFps: boolean;

  /* progression */
  xp: number;
  level: number;
  totalXp: number;
  achievements: Achievement[];
  quests: Quest[];
  collectibles: Collectible[];
  visitedZones: string[];

  /* world interaction */
  zones: Zone[];
  nearbyZone: Zone | null;
  teleportTarget: Vec3 | null;
  /** Where the player has asked to be guided to; drives the ground arrows. */
  navTarget: NavTarget | null;
  toasts: Toast[];

  /* actions */
  setPhase: (p: GamePhase) => void;
  setLoadProgress: (n: number) => void;
  beginGame: () => void;
  skipIntro: () => void;
  openModal: (m: ModalId) => void;
  closeModal: () => void;
  togglePause: () => void;

  setQuality: (q: QualityLevel) => void;
  /** Used by the framerate monitor; does not disable auto-adjustment. */
  autoSetQuality: (q: QualityLevel) => void;
  setTheme: (t: ThemeId) => void;
  toggleSfx: () => void;
  toggleMusic: () => void;
  setMasterVolume: (v: number) => void;
  setInvertY: (v: boolean) => void;
  setMouseSensitivity: (v: number) => void;
  toggleFps: () => void;

  addXp: (amount: number, label?: string) => void;
  unlockAchievement: (id: string) => void;
  collectCore: (id: string) => void;
  setNearbyZone: (z: Zone | null) => void;
  setNavTarget: (t: NavTarget | null) => void;
  teleportTo: (pos: Vec3) => void;
  clearTeleport: () => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  resetRun: () => void;
}

let toastSeq = 0;

export const useGameStore = create<GameState>((set, get) => ({
  // Starts on the menu, not a loading screen: the DOM shell paints in a few
  // hundred ms and the 3D engine streams in behind it.
  phase: 'START',
  loadProgress: 0,
  activeModal: null,
  introSkipped: false,

  quality: detectQuality(),
  qualityAuto: true,
  theme: 'cyan',
  sfxEnabled: true,
  musicEnabled: true,
  masterVolume: 0.7,
  invertY: false,
  mouseSensitivity: 1,
  showFps: false,

  xp: 0,
  level: 1,
  totalXp: 0,
  achievements: ACHIEVEMENTS.map((a) => ({ ...a })),
  quests: QUESTS.map((q) => ({ ...q })),
  collectibles: COLLECTIBLES.map((c) => ({ ...c })),
  visitedZones: [],

  zones: ZONES,
  nearbyZone: null,
  teleportTarget: null,
  navTarget: null,
  toasts: [],

  /* --------------------------------------------------------------- lifecycle */

  setPhase: (p) => set({ phase: p }),
  setLoadProgress: (n) => set({ loadProgress: Math.min(100, Math.max(0, n)) }),

  beginGame: () => {
    audio.unlock();
    if (get().musicEnabled) audio.startMusic();
    audio.uiClick();
    set({ phase: 'INTRO' });
  },

  skipIntro: () => {
    if (get().phase !== 'INTRO') return;
    set({ phase: 'PLAYING', introSkipped: true });
  },

  openModal: (m) => {
    audio.modalOpen();
    const questId = QUEST_FOR_MODAL[m];
    const wasPending = questId ? !get().quests.find((q) => q.id === questId)?.done : false;

    set((s) => ({
      activeModal: m,
      quests: questId
        ? s.quests.map((q) => (q.id === questId ? { ...q, done: true } : q))
        : s.quests,
    }));

    if (wasPending) {
      get().addXp(80, 'Objective complete');
    }
    if (m === 'projects') get().unlockAchievement('lab-visit');
    if (m === 'secret') get().unlockAchievement('vault');
    if (m === 'console') get().unlockAchievement('terminal');
  },

  closeModal: () => {
    audio.modalClose();
    set({ activeModal: null });
  },

  togglePause: () => {
    const { phase } = get();
    if (phase === 'PLAYING') {
      audio.uiClick();
      set({ phase: 'PAUSED' });
    } else if (phase === 'PAUSED') {
      audio.uiClick();
      set({ phase: 'PLAYING' });
    }
  },

  /* ---------------------------------------------------------------- settings */

  setQuality: (q) => {
    audio.uiClick();
    // A deliberate choice always wins over the monitor.
    set({ quality: q, qualityAuto: false });
  },

  autoSetQuality: (q) => set({ quality: q }),
  setTheme: (t) => {
    audio.uiClick();
    set({ theme: t });
  },
  toggleSfx: () => {
    const next = !get().sfxEnabled;
    audio.setSfxEnabled(next);
    if (next) audio.uiClick();
    set({ sfxEnabled: next });
  },
  toggleMusic: () => {
    const next = !get().musicEnabled;
    audio.setMusicEnabled(next);
    audio.uiClick();
    set({ musicEnabled: next });
  },
  setMasterVolume: (v) => {
    audio.setMasterVolume(v);
    set({ masterVolume: v });
  },
  setInvertY: (v) => set({ invertY: v }),
  setMouseSensitivity: (v) => set({ mouseSensitivity: v }),
  toggleFps: () => set((s) => ({ showFps: !s.showFps })),

  /* ------------------------------------------------------------- progression */

  addXp: (amount, label) => {
    if (amount <= 0) return;
    let { xp, level } = get();
    xp += amount;
    let levelled = false;

    // Loop, so a single large award can grant several levels.
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level += 1;
      levelled = true;
    }

    set((s) => ({ xp, level, totalXp: s.totalXp + amount }));

    if (levelled) {
      audio.levelUp();
      get().pushToast({
        kind: 'xp',
        title: `LEVEL ${level}`,
        body: 'Neural capacity expanded.',
        icon: 'trending-up',
      });
    } else if (label) {
      get().pushToast({ kind: 'xp', title: `+${amount} XP`, body: label, icon: 'zap' });
    }
  },

  unlockAchievement: (id) => {
    const found = get().achievements.find((a) => a.id === id);
    if (!found || found.unlocked) return;

    set((s) => ({
      achievements: s.achievements.map((a) => (a.id === id ? { ...a, unlocked: true } : a)),
    }));
    audio.achievement();
    get().pushToast({
      kind: 'achievement',
      title: found.name,
      body: found.description,
      icon: found.icon,
    });
    get().addXp(found.xp);
  },

  collectCore: (id) => {
    const core = get().collectibles.find((c) => c.id === id);
    if (!core || core.collected) return;

    audio.pickup();
    const next = get().collectibles.map((c) => (c.id === id ? { ...c, collected: true } : c));
    set({ collectibles: next });
    get().addXp(120, core.name);

    if (next.every((c) => c.collected)) {
      audio.vaultUnlock();
      get().unlockAchievement('collector');
      get().pushToast({
        kind: 'quest',
        title: 'VAULT UNLOCKED',
        body: 'All five cores recovered. The Vault is open to the east.',
        icon: 'unlock',
      });
    }
  },

  setNearbyZone: (z) => {
    const prev = get().nearbyZone;
    if (prev?.id === z?.id) return;
    if (z) audio.interact();
    set({ nearbyZone: z });

    if (z && !get().visitedZones.includes(z.id)) {
      const visited = [...get().visitedZones, z.id];
      set({ visitedZones: visited });
      // Every landmark except the optional arcade and the secret vault.
      // Guarded against an empty list, since [].every() is vacuously true and
      // would hand out the achievement before the player moved.
      const required = QUEST_ZONES.map((z) => z.id);
      if (required.length > 0 && required.every((r) => visited.includes(r))) {
        get().unlockAchievement('cartographer');
      }
    }
  },

  setNavTarget: (t) => {
    const prev = get().navTarget;
    if (prev?.id === t?.id) return;

    set({ navTarget: t });
    if (t) {
      audio.interact();
      get().pushToast({
        kind: 'quest',
        title: 'ROUTE PLOTTED',
        body: `Follow the arrows to ${t.name}.`,
        icon: 'navigation',
      });
    }
  },

  teleportTo: (pos) => {
    set({ teleportTarget: pos, activeModal: null });
  },
  clearTeleport: () => set({ teleportTarget: null }),

  pushToast: (t) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-3) }));
    window.setTimeout(() => get().dismissToast(id), 4600);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  resetRun: () =>
    set({
      phase: 'START',
      activeModal: null,
      xp: 0,
      level: 1,
      totalXp: 0,
      achievements: ACHIEVEMENTS.map((a) => ({ ...a })),
      quests: QUESTS.map((q) => ({ ...q })),
      collectibles: COLLECTIBLES.map((c) => ({ ...c })),
      visitedZones: [],
      nearbyZone: null,
      navTarget: null,
      teleportTarget: [0, 1.1, 0],
    }),
}));

/** The first quest that is not yet done, or null when the chain is complete. */
export const selectActiveQuest = (s: GameState) => s.quests.find((q) => !q.done) ?? null;

/** Cores collected so far. */
export const selectCoreCount = (s: GameState) => s.collectibles.filter((c) => c.collected).length;

/* Dev-only inspection hook, mirroring the one in systems/input.ts. Vite folds
   import.meta.env.DEV to false in production so this is dropped from the build. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __store: unknown }).__store = useGameStore;
}
