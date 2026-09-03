import { Collider, Vec3, Zone, Collectible } from '../types/game';
import { has, portfolio } from '../config/portfolio';

/* ---------------------------------------------------------------------------
 * Deterministic, content-driven world generation.
 *
 * The city is generated from a fixed seed so the geometry the renderer draws
 * and the colliders the physics uses are always identical, and so the layout
 * never shuffles between visits.
 *
 * Landmarks are derived from portfolio.ts: a section with no content does not
 * get a building, and the plot it would have occupied is filled with ordinary
 * towers instead. Add your first job and the Career Timeline appears on its
 * own, with the quest chain and minimap updating to match.
 * ------------------------------------------------------------------------- */

/** mulberry32 — small, fast, deterministic PRNG. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD_BOUNDS = { minX: -62, maxX: 62, minZ: -40, maxZ: 92 };

/* ------------------------------------------------------------- LANDMARKS --- */

/**
 * Every landmark the city can contain, in the order a visitor should meet
 * them. `enabled` decides whether it exists at all.
 */
interface ZoneTemplate extends Omit<Zone, 'position'> {
  enabled: boolean;
  /** Landmarks with a fixed home keep it; the rest take the next free plot. */
  anchor?: Vec3;
}

const TEMPLATES: ZoneTemplate[] = [
  {
    id: 'ai-lab',
    short: 'AI LAB',
    name: 'AI RESEARCH LAB',
    subtitle: 'Featured Work',
    radius: 5.2,
    color: '#22d3ee',
    modal: 'projects',
    prompt: 'ENTER THE AI LAB',
    questTitle: 'Enter the AI Lab',
    objective: 'Head north up the boulevard and enter the AI Research Lab.',
    enabled: has.projects,
    // Always the first thing you see, straight up the boulevard.
    anchor: [0, 0, 34],
  },
  {
    id: 'profile',
    short: 'PROFILE',
    name: 'OPERATOR PROFILE',
    subtitle: 'About Me',
    radius: 5,
    color: '#38bdf8',
    modal: 'about',
    prompt: 'READ PROFILE',
    questTitle: 'Read the Operator Profile',
    objective: 'Visit the Operator Profile south of the plaza.',
    enabled: has.about,
    // Behind the spawn point, so it is discoverable but never in the way.
    anchor: [0, 0, -26],
  },
  {
    id: 'skills',
    short: 'SKILLS',
    name: 'SKILL MATRIX',
    subtitle: 'Capabilities',
    radius: 5,
    color: '#a855f7',
    modal: 'skills',
    prompt: 'SCAN SKILL MATRIX',
    questTitle: 'Scan the Skill Matrix',
    objective: 'Scan the Skill Matrix.',
    enabled: has.skills,
  },
  {
    id: 'experience',
    short: 'CAREER',
    name: 'CAREER TIMELINE',
    subtitle: 'Experience',
    radius: 5,
    color: '#34d399',
    modal: 'experience',
    prompt: 'REVIEW TIMELINE',
    questTitle: 'Review the Career Timeline',
    objective: 'Review the Career Timeline.',
    enabled: has.experience,
  },
  {
    id: 'credentials',
    short: 'AWARDS',
    name: 'ACHIEVEMENT HALL',
    subtitle: 'Certifications',
    radius: 5,
    color: '#fbbf24',
    modal: 'credentials',
    prompt: 'INSPECT CREDENTIALS',
    questTitle: 'Inspect the Achievement Hall',
    objective: 'Inspect the credentials in the Achievement Hall.',
    enabled: has.credentials,
  },
  {
    id: 'resume',
    short: 'RESUME',
    name: 'DATA TERMINAL',
    subtitle: 'Resume & Links',
    radius: 5,
    color: '#60a5fa',
    modal: 'resume',
    prompt: 'ACCESS TERMINAL',
    questTitle: 'Access the Data Terminal',
    objective: 'Access the Data Terminal.',
    enabled: has.resume,
  },
  {
    id: 'contact',
    short: 'CONTACT',
    name: 'COMMS TOWER',
    subtitle: 'Contact',
    radius: 5.5,
    color: '#f472b6',
    modal: 'contact',
    prompt: 'OPEN A CHANNEL',
    questTitle: 'Reach the Comms Tower',
    objective: 'Reach the Comms Tower at the north end and open a channel.',
    enabled: has.contact,
    // Always the northern terminus — the end of the journey.
    anchor: [0, 0, 72],
  },
  {
    id: 'arcade',
    short: 'ARCADE',
    name: 'ARCADE CABINET',
    subtitle: 'Mini-Game',
    radius: 3.6,
    color: '#c084fc',
    modal: 'arcade',
    prompt: 'PLAY NEURAL BREACH',
    questTitle: 'Play Neural Breach',
    objective: 'Optional: play the arcade cabinet in the plaza.',
    enabled: true,
    anchor: [8.5, 0, 6],
  },
  {
    id: 'vault',
    short: 'VAULT',
    name: 'THE VAULT',
    subtitle: 'Secret Area',
    radius: 5,
    color: '#ef4444',
    modal: 'secret',
    prompt: 'BREACH THE VAULT',
    questTitle: 'Breach the Vault',
    objective: 'Find all 5 Data Cores, then breach the Vault.',
    locked: true,
    enabled: true,
    anchor: [46, 0, 40],
  },
];

/**
 * Free plots either side of the boulevard, ordered so landmarks fill in from
 * nearest to furthest. Unclaimed plots are given back to the building
 * generator, so a sparse portfolio still produces a dense city.
 */
const PLOTS: Vec3[] = [
  [-30, 0, 20],
  [30, 0, 20],
  [-30, 0, 56],
  [30, 0, 56],
  [-46, 0, 38],
  [-30, 0, -12],
];

export const ZONES: Zone[] = (() => {
  const active = TEMPLATES.filter((t) => t.enabled);
  const plots = [...PLOTS];

  return active.map((template) => {
    const position: Vec3 = template.anchor ?? plots.shift() ?? [0, 0, 34];
    // `enabled` and `anchor` are build-time concerns; strip them off.
    const { enabled: _enabled, anchor: _anchor, ...zone } = template;
    return { ...zone, position };
  });
})();

/* ------------------------------------------------------------- BUILDINGS --- */

export interface Building {
  id: number;
  position: Vec3;
  size: Vec3;
  color: string;
  bands: number;
  phase: number;
  spire: number;
}

const NEON = ['#22d3ee', '#f472b6', '#a855f7', '#34d399', '#fbbf24'];

/** The plaza is kept clear so the player always has somewhere to spawn. */
const PLAZA_RADIUS = 13;

/** Derived from the landmarks that actually exist, so unused plots get built on. */
const KEEPOUT: { x: number; z: number; r: number }[] = [
  { x: 0, z: 0, r: PLAZA_RADIUS },
  ...ZONES.map((z) => ({
    x: z.position[0],
    z: z.position[2],
    r: z.radius + 5.5,
  })),
];

function blocked(x: number, z: number, pad: number) {
  for (const k of KEEPOUT) {
    if (Math.hypot(x - k.x, z - k.z) < k.r + pad) return true;
  }
  return false;
}

export const buildings: Building[] = (() => {
  const rng = makeRng(0xc0ffee);
  const list: Building[] = [];
  let id = 0;

  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -2; gz <= 6; gz++) {
      // Keep the central boulevard walkable.
      if (gx === 0) continue;

      const x = gx * 13 + (rng() - 0.5) * 4;
      const z = gz * 14 + 14 + (rng() - 0.5) * 4;

      const w = 6 + rng() * 4;
      const d = 6 + rng() * 4;

      if (blocked(x, z, Math.max(w, d) * 0.5 + 2)) continue;

      // Towers grow towards the edges of the map, framing the play area.
      const edge = Math.min(1, Math.abs(gx) / 4);
      const h = 10 + rng() * 18 + edge * 34;

      list.push({
        id: id++,
        position: [x, h / 2, z],
        size: [w, h, d],
        color: NEON[Math.floor(rng() * NEON.length)],
        bands: 2 + Math.floor(rng() * 4),
        phase: rng() * Math.PI * 2,
        spire: rng() > 0.72 ? 3 + rng() * 7 : 0,
      });
    }
  }
  return list;
})();

/** Static colliders: one per building footprint. */
export const colliders: Collider[] = buildings.map((b) => ({
  x: b.position[0],
  z: b.position[2],
  hw: b.size[0] / 2,
  hd: b.size[2] / 2,
  top: b.size[1],
}));

/* ----------------------------------------------------------- COLLECTIBLES --- */

export const COLLECTIBLES: Collectible[] = [
  { id: 'core-1', name: 'Data Core: ALPHA', position: [-16, 1.4, 4], collected: false },
  { id: 'core-2', name: 'Data Core: BETA', position: [18, 1.4, 40], collected: false },
  { id: 'core-3', name: 'Data Core: GAMMA', position: [-20, 1.4, 44], collected: false },
  { id: 'core-4', name: 'Data Core: DELTA', position: [12, 1.4, 68], collected: false },
  { id: 'core-5', name: 'Data Core: EPSILON', position: [-8, 1.4, -18], collected: false },
];

/* ------------------------------------------------------------- STREET PROPS */

export const PROPS: { x: number; z: number; rot: number; kind: 'lamp' | 'sign' | 'crate' }[] =
  (() => {
    const rng = makeRng(90210);
    const out: { x: number; z: number; rot: number; kind: 'lamp' | 'sign' | 'crate' }[] = [];

    // Lamp posts line the boulevard for the full length of the map.
    for (let z = -30; z <= 84; z += 9) {
      out.push({ x: -7.5, z, rot: 0, kind: 'lamp' });
      out.push({ x: 7.5, z, rot: Math.PI, kind: 'lamp' });
    }

    for (let i = 0; i < 22; i++) {
      const x = (rng() - 0.5) * 100;
      const z = rng() * 120 - 34;
      if (blocked(x, z, 4)) continue;
      out.push({ x, z, rot: rng() * Math.PI * 2, kind: rng() > 0.5 ? 'crate' : 'sign' });
    }
    return out;
  })();

/** Landmarks that form the main quest chain (excludes optional side content). */
export const QUEST_ZONES = ZONES.filter((z) => z.id !== 'arcade' && z.id !== 'vault');

/** Sanity check for the owner: warn if the config produced an empty city. */
if (import.meta.env.DEV && QUEST_ZONES.length === 0) {
  console.warn(
    '[portfolio] No landmarks were generated. Add content to src/config/portfolio.ts ' +
      '(projects, about, skills, experience, credentials or contact).',
  );
}
