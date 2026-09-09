import type { Vec3 } from '../types/game';

/* ============================================================================
 *  THE WORLDS
 * ----------------------------------------------------------------------------
 *  One entry per place the portfolio can be set in. This is the single source
 *  of truth: the chooser screen, the scene's lighting and its fog all read
 *  from here, so they cannot drift apart.
 *
 *  Every world uses the SAME layout. The streets, the landmarks, your content,
 *  the map and the navigation arrows are identical wherever you are - only the
 *  scenery changes. That is what makes switching free.
 *
 *  To add a fourth: write a component like SpaceStation.tsx, add an entry
 *  below, and register it in Scene.tsx. Nothing else needs to know.
 * ========================================================================== */

export type WorldId =
  | 'neon-city'
  | 'space-station'
  | 'ancient-ruins'
  | 'lantern-district'
  | 'battleground';

export interface WorldDefinition {
  id: WorldId;
  /** Shown on the chooser card. */
  name: string;
  /** One line under the name. */
  tagline: string;
  /** Two or three sentences on the card once it is selected. */
  description: string;

  /**
   * Three colours describing the place, darkest first. Used to paint the
   * chooser card so it reads as that world before anything has loaded.
   */
  swatch: [string, string, string];

  fog: {
    color: string;
    near: number;
    /** Multiplies the quality setting's fog distance. */
    farScale: number;
  };

  light: {
    /** Direction of the key light. Should agree with any sun in the sky. */
    keyPosition: Vec3;
    keyIntensity: number;
    keyColor: string;
    ambientIntensity: number;
    ambientColor: string;
    /** Sky colour, ground colour, strength. */
    hemisphere: [string, string, number];
  };
}

export const WORLDS: WorldDefinition[] = [
  {
    id: 'neon-city',
    name: 'NEON CITY',
    tagline: 'Rain-soaked streets, endless night',
    description:
      'A cyberpunk block at three in the morning. Neon bleeds across wet tarmac, rain falls through the light of the signs, and towers disappear into low cloud.',
    swatch: ['#05060e', '#22d3ee', '#f472b6'],
    fog: { color: '#06070f', near: 26, farScale: 1 },
    light: {
      // Kept near-neutral: tinting the key light with the theme colour looked
      // good on grey towers but turned an orange character green.
      keyPosition: [38, 60, -20],
      keyIntensity: 1.5,
      keyColor: '#e8f0ff',
      ambientIntensity: 0.45,
      ambientColor: '#243352',
      hemisphere: ['#1b2a5a', '#05060e', 0.7],
    },
  },
  {
    id: 'space-station',
    name: 'ORBITAL STATION',
    tagline: 'A hangar deck, open space above',
    description:
      'A docking deck in high orbit. Plated floor under your boots, station modules rising either side, and nothing overhead but stars and a very small, very bright sun.',
    swatch: ['#05070c', '#8ea0b8', '#22d3ee'],
    // Vacuum is clear, so only enough haze to hide the far edge of the deck.
    fog: { color: '#070910', near: 46, farScale: 1.35 },
    light: {
      // Matches the sun drawn in the sky shader, or the shadows point the
      // wrong way. Vacuum means almost no bounce, hence the weak fill.
      keyPosition: [82, 30, -99],
      keyIntensity: 2.1,
      keyColor: '#fff2df',
      ambientIntensity: 0.26,
      ambientColor: '#1b2438',
      hemisphere: ['#16224a', '#05060e', 0.45],
    },
  },
  {
    id: 'ancient-ruins',
    name: 'SUNKEN RUINS',
    tagline: 'Golden hour over old stone',
    description:
      'A temple complex the desert has been eating for a thousand years. Broken columns, weathered sandstone, and dust turning gold in the last of the light.',
    swatch: ['#1a1109', '#c98a4b', '#ffd9a0'],
    // Warm haze rolling between the stones, thicker than the city's.
    fog: { color: '#3a2415', near: 22, farScale: 0.95 },
    light: {
      // A low sun near the horizon, throwing long shadows across the flagstones.
      keyPosition: [-96, 26, 54],
      keyIntensity: 1.9,
      keyColor: '#ffc987',
      /* Daylight bounces off everything, so the fill is far stronger here than
         in either night setting - but only so far. Sandstone is about five
         times as reflective as the city's near-black towers, so the
         intensities that make neon look good would drive this flat white. */
      ambientIntensity: 0.5,
      ambientColor: '#6b5137',
      hemisphere: ['#c98f52', '#241708', 0.65],
    },
  },
  {
    id: 'lantern-district',
    name: 'LANTERN DISTRICT',
    tagline: 'Back streets, warm light, falling petals',
    description:
      'A narrow shopping street after closing. Paper lanterns strung overhead, vending machines humming in the dark, shop banners hanging down the walls, and blossom coming off the trees onto wet asphalt.',
    swatch: ['#0d0812', '#e2564a', '#ffd6a5'],
    fog: { color: '#120a14', near: 22, farScale: 0.9 },
    light: {
      // Low and warm, as if it were all coming from the shopfronts.
      keyPosition: [24, 34, 40],
      keyIntensity: 1.25,
      keyColor: '#ffe0c2',
      ambientIntensity: 0.5,
      ambientColor: '#3a2233',
      hemisphere: ['#4a2a3a', '#0b0710', 0.75],
    },
  },
  {
    id: 'battleground',
    name: 'THE DROP ZONE',
    tagline: 'Abandoned compound, closing circle',
    description:
      'A disused military settlement under a flat grey sky. Concrete blocks and corrugated roofs, supply crates left where they fell, watchtowers over dry grass, and the containment wall drawing in around the edge of the map.',
    swatch: ['#22261a', '#7d8c5f', '#cfc9a4'],
    // Dust and distance haze, the thickest of the five.
    fog: { color: '#8a8b76', near: 30, farScale: 1.1 },
    light: {
      /* High and near-white: overcast daylight, which is the light this kind
         of place is always shot in. Very strong fill, because an overcast sky
         is one enormous soft source and almost nothing sits in true shadow. */
      /* Overcast is FILL-dominant, not key-dominant: the cloud layer is one
         huge soft source, so almost all the light arrives from everywhere at
         once and very little of it comes straight down a beam. Lighting it
         like sunshine - a strong key over a bright concrete albedo - drives
         the compounds to flat white, which is the failure mode for this kind
         of scene. Weak key, heavy ambient and hemisphere. */
      keyPosition: [40, 88, 30],
      keyIntensity: 1.0,
      keyColor: '#fbf7ea',
      ambientIntensity: 0.6,
      ambientColor: '#8f927c',
      hemisphere: ['#b9bda4', '#3b3a2c', 0.85],
    },
  },
];

export const DEFAULT_WORLD: WorldId = 'neon-city';

/** Look up a world, falling back rather than crashing on an unknown id. */
export function getWorld(id: WorldId | string): WorldDefinition {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
