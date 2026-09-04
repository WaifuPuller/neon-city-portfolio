/* ============================================================================
 *  YOUR IMAGES AND COLOURS
 * ----------------------------------------------------------------------------
 *  The pictures themselves go in   src/assets/images/   - see the README in
 *  there. You do NOT need to list them below: whatever files are in that
 *  folder are found automatically when the site builds.
 *
 *  This file is only for HOW they behave, and for the building colours.
 * ========================================================================== */

/* ----------------------------------------------------------------- COLOURS ---
 * The neon colours the towers are lit with. One is picked per building.
 *
 * Add, remove or change as many as you like - any number works. Keep them
 * bright: these are light sources, and a dark colour reads as no colour at all
 * once it is glowing against a black sky.
 * -------------------------------------------------------------------------- */

export const buildingPalette: string[] = [
  '#22d3ee', // cyan
  '#f472b6', // pink
  '#a855f7', // violet
  '#34d399', // mint
  '#fbbf24', // amber
];

/* ------------------------------------------------------------ HOW IT LOOKS ---
 * Settings for the panels and the orbiting craft.
 * -------------------------------------------------------------------------- */

export const media = {
  /** The image panels mounted on the towers. */
  buildingImages: {
    /**
     * 'orbit'  the panel slowly circles the tower, so it is readable from
     *          wherever you happen to be standing
     * 'fixed'  the panel stays put on the side facing the main street
     */
    display: 'orbit' as 'orbit' | 'fixed',

    /** Seconds for one full lap of the tower. Bigger is slower. */
    orbitSeconds: 26,

    /** Widest the panel may be, in metres. It shrinks to fit narrow towers. */
    maxWidth: 7.5,

    /** 0 = see-through, 1 = solid. */
    opacity: 0.92,

    /** A glowing frame around each panel. Set to false for the picture alone. */
    frame: true,
  },

  /** The craft that circles the outside of the map. */
  orbiter: {
    /** Set to false to remove it entirely. */
    enabled: true,

    /** 'spaceship' or 'asteroid'. */
    kind: 'spaceship' as 'spaceship' | 'asteroid',

    /**
     * How far out it flies, in metres from the centre of the map.
     * The map itself is about 62m wide, so anything over ~110 is safely
     * outside it and reads as being off in the distance.
     */
    radius: 152,

    /** How high it sits. */
    height: 54,

    /** Seconds for one full lap. 120 is a slow, stately drift. */
    orbitSeconds: 120,

    /** Tilts the orbit so it rises and sets rather than staying flat. */
    tilt: 0.16,

    /** Overall size. 1 is roughly a 26m hull; raise it to make it loom. */
    scale: 1,

    /** Width of the banner on its flank, in metres. */
    bannerWidth: 17,

    /** Hull colour. The engine glow uses your current neon theme. */
    color: '#8ea0b8',
  },
} as const;

/* ============================================================================
 *  FINDING THE IMAGE FILES
 * ----------------------------------------------------------------------------
 *  Vite scans the folder at build time, so only files that really exist are
 *  ever referenced. That means no broken-image requests for slots you have not
 *  filled in, and no paths to keep in sync by hand - which is the whole reason
 *  this is not just a list of filenames.
 * ========================================================================== */

type UrlMap = Record<string, string>;

const buildingFiles = import.meta.glob('../assets/images/building-*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as UrlMap;

const orbiterFiles = import.meta.glob('../assets/images/orbiter.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as UrlMap;

/**
 * Every building image found, in filename order.
 *
 * Sorted by path so building-01 comes before building-02. That is also why the
 * README asks for zero-padded numbers: without the padding, "building-10"
 * sorts before "building-2".
 */
export const buildingImageUrls: string[] = Object.keys(buildingFiles)
  .sort()
  .map((path) => buildingFiles[path]);

/** The orbiter's banner, or null when no orbiter.* file has been added. */
export const orbiterImageUrl: string | null = (() => {
  const found = Object.keys(orbiterFiles).sort();
  return found.length > 0 ? orbiterFiles[found[0]] : null;
})();

if (import.meta.env.DEV) {
  console.info(
    `[portfolio] images: ${buildingImageUrls.length} building panel(s), ` +
      `orbiter banner ${orbiterImageUrl ? 'found' : 'not added'}. ` +
      'Drop files into src/assets/images/ - see the README in that folder.',
  );
}
