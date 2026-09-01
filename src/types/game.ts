export type GamePhase = 'BOOT' | 'START' | 'INTRO' | 'PLAYING' | 'PAUSED';

export type ModalId =
  | 'about'
  | 'skills'
  | 'projects'
  | 'experience'
  | 'credentials'
  | 'contact'
  | 'resume'
  | 'secret'
  | 'arcade'
  | 'settings'
  | 'console'
  | 'achievements';

export type ModalType = ModalId | null;

export type QualityLevel = 'ultra' | 'high' | 'medium' | 'low';

export type ThemeId = 'cyan' | 'magenta' | 'emerald' | 'amber';

export type Vec3 = [number, number, number];

/** A visitable landmark in the city. Walking into its radius offers [E]. */
export interface Zone {
  id: string;
  name: string;
  subtitle: string;
  position: Vec3;
  /** Radius within which the interact prompt appears. */
  radius: number;
  color: string;
  modal: ModalId;
  prompt: string;
  /** Short title shown in the quest log, e.g. "Enter the AI Lab". */
  questTitle: string;
  /** One-line direction shown under the quest title. */
  objective: string;
  /** Requires all data cores before it will open. */
  locked?: boolean;
}

export interface Collectible {
  id: string;
  name: string;
  position: Vec3;
  collected: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  unlocked: boolean;
  /** Hidden achievements show as "???" until unlocked. */
  hidden?: boolean;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  done: boolean;
}

/** Axis-aligned solid used by the collision system. */
export interface Collider {
  /** Centre on the XZ plane. */
  x: number;
  z: number;
  /** Half-extents on the XZ plane. */
  hw: number;
  hd: number;
  /** Top surface height, so the player can stand on it. */
  top: number;
}
