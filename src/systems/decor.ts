import { buildings, PROPS } from './world';
import type { Vec3 } from '../types/game';

/* ---------------------------------------------------------------------------
 * Deterministic surface decoration.
 *
 * Lit windows, hull greebling, rubble - the small stuff that separates "a box"
 * from "a building". All of it is generated once here, from the same seeded
 * approach the city itself uses, so it never shuffles between visits.
 *
 * WHY THIS IS CHEAP
 * -----------------
 * Every list below is drawn as a SINGLE instanced mesh. Two thousand windows
 * and forty windows cost the same one draw call; the only difference is
 * triangles, and a two-triangle quad is nothing. What actually costs money on
 * a weak GPU is full-screen work - bloom, shadow passes, pixel ratio - not
 * geometry like this.
 *
 * That matters because the low preset used to switch all of it off, which
 * saved almost nothing and left the world looking like grey packing crates.
 * ------------------------------------------------------------------------- */

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

export interface DecorItem {
  pos: Vec3;
  /** Rotation about Y, in radians. */
  rotY: number;
  scale: Vec3;
  color?: string;
}

/** A soft glow blob, drawn as a camera-facing point. */
export interface GlowItem {
  pos: Vec3;
  color: string;
  /** World-space diameter of the halo. */
  size: number;
}

/* ===========================================================================
 * LIT WINDOWS
 * The single biggest difference between a box and a tower after dark.
 * ========================================================================= */

const WINDOW_W = 0.42;
const WINDOW_H = 0.62;
/** Distance between window centres. */
const SPACING_X = 1.5;
const SPACING_Y = 2.1;

export const cityWindows: DecorItem[] = (() => {
  const rng = makeRng(0x5eed01);
  const out: DecorItem[] = [];

  for (const b of buildings) {
    const [w, h, d] = b.size;
    const base = b.position[1] - h / 2;

    // Each face gets its own grid. Faces are handled as a pair of axes so the
    // same maths does all four sides.
    const faces: { normal: Vec3; across: number; rotY: number }[] = [
      { normal: [0, 0, 1], across: w, rotY: 0 },
      { normal: [0, 0, -1], across: w, rotY: Math.PI },
      { normal: [1, 0, 0], across: d, rotY: Math.PI / 2 },
      { normal: [-1, 0, 0], across: d, rotY: -Math.PI / 2 },
    ];

    // How lit up this particular tower is: some are working late, some are
    // nearly dark. Uniform occupancy across the whole city looks synthetic.
    const occupancy = 0.22 + rng() * 0.5;

    for (const face of faces) {
      const columns = Math.max(1, Math.floor((face.across - 1.2) / SPACING_X));
      const rows = Math.max(1, Math.floor((h - 3.5) / SPACING_Y));
      const startX = -((columns - 1) * SPACING_X) / 2;

      for (let c = 0; c < columns; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() > occupancy) continue;

          const along = startX + c * SPACING_X;
          // Start above street level so windows do not sit in the pavement.
          const y = base + 2.6 + r * SPACING_Y;

          const px =
            b.position[0] +
            face.normal[0] * ((face.normal[0] !== 0 ? w : d) / 2 + 0.04) +
            (face.normal[0] !== 0 ? 0 : along);
          const pz =
            b.position[2] +
            face.normal[2] * ((face.normal[2] !== 0 ? d : w) / 2 + 0.04) +
            (face.normal[2] !== 0 ? 0 : along);

          out.push({
            pos: [px, y, pz],
            rotY: face.rotY,
            scale: [WINDOW_W, WINDOW_H, 1],
            // Most windows are ordinary warm interior light; a few carry the
            // building's neon, which is what keeps the palette reading.
            color: rng() > 0.82 ? b.color : rng() > 0.5 ? '#ffd9a8' : '#cfe4ff',
          });
        }
      }
    }
  }

  return out;
})();

/* ===========================================================================
 * STATION GREEBLING
 * Panels, vents and conduit runs bolted onto the module hulls.
 * ========================================================================= */

export const stationGreebles: DecorItem[] = (() => {
  const rng = makeRng(0x5eed02);
  const out: DecorItem[] = [];

  for (const b of buildings) {
    const [w, h, d] = b.size;
    const base = b.position[1] - h / 2;
    const count = 5 + Math.floor(rng() * 7);

    for (let i = 0; i < count; i++) {
      // Pick a face, then a spot on it.
      const onX = rng() > 0.5;
      const side = rng() > 0.5 ? 1 : -1;
      const along = (rng() - 0.5) * (onX ? d : w) * 0.78;
      const y = base + 2 + rng() * (h - 4);

      const plateW = 0.8 + rng() * 2.4;
      const plateH = 0.5 + rng() * 1.6;

      out.push({
        pos: onX
          ? [b.position[0] + side * (w / 2 + 0.09), y, b.position[2] + along]
          : [b.position[0] + along, y, b.position[2] + side * (d / 2 + 0.09)],
        rotY: onX ? Math.PI / 2 : 0,
        scale: [plateW, plateH, 0.18],
      });
    }
  }

  return out;
})();

/** Small running lights dotted over the station hulls. */
export const stationLights: DecorItem[] = (() => {
  const rng = makeRng(0x5eed03);
  const out: DecorItem[] = [];

  for (const b of buildings) {
    const [w, h, d] = b.size;
    const base = b.position[1] - h / 2;
    const count = 3 + Math.floor(rng() * 4);

    for (let i = 0; i < count; i++) {
      const onX = rng() > 0.5;
      const side = rng() > 0.5 ? 1 : -1;
      const along = (rng() - 0.5) * (onX ? d : w) * 0.8;
      const y = base + 3 + rng() * (h - 5);

      out.push({
        pos: onX
          ? [b.position[0] + side * (w / 2 + 0.12), y, b.position[2] + along]
          : [b.position[0] + along, y, b.position[2] + side * (d / 2 + 0.12)],
        rotY: onX ? Math.PI / 2 : 0,
        scale: [0.9, 0.14, 1],
        color: b.color,
      });
    }
  }

  return out;
})();

/* ===========================================================================
 * RUBBLE
 * Fallen stone banked against the ruins, so nothing meets the ground at a
 * clean right angle.
 * ========================================================================= */

export const ruinRubble: DecorItem[] = (() => {
  const rng = makeRng(0x5eed04);
  const out: DecorItem[] = [];

  for (const b of buildings) {
    const [w, h, d] = b.size;
    const base = b.position[1] - h / 2;
    const count = 6 + Math.floor(rng() * 8);

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const reach = 0.55 + rng() * 0.7;
      const size = 0.35 + rng() * 1.1;

      out.push({
        pos: [
          b.position[0] + Math.sin(angle) * (w / 2) * (1 + reach),
          base + size * 0.35,
          b.position[2] + Math.cos(angle) * (d / 2) * (1 + reach),
        ],
        rotY: rng() * Math.PI * 2,
        scale: [size * 1.5, size * 0.75, size * 1.2],
      });
    }
  }

  return out;
})();

/** Weathered courses banding the ruins, breaking up the flat faces. */
export const ruinCourses: DecorItem[] = (() => {
  const out: DecorItem[] = [];

  for (const b of buildings) {
    const [w, h, d] = b.size;
    const base = b.position[1] - h / 2;
    const bands = Math.max(1, Math.floor(h / 7));

    for (let i = 1; i <= bands; i++) {
      out.push({
        pos: [b.position[0], base + (h / (bands + 1)) * i, b.position[2]],
        rotY: 0,
        scale: [w + 0.34, 0.5, d + 0.34],
      });
    }
  }

  return out;
})();

/* ===========================================================================
 * GLOW
 *
 * A stand-in for bloom on machines that cannot afford the post-processing
 * pass. Without it every emissive surface on the low preset is a flat patch of
 * colour, which is most of why that setting looked lifeless: in a world lit by
 * neon, the halo IS the lighting.
 *
 * Drawn as camera-facing points, so there is no per-frame CPU work and no
 * billboarding to keep up to date.
 *
 * SIZE MATTERS MORE THAN COUNT.
 * A halo costs exactly the pixels it covers, and additive blending means every
 * one of those pixels is read and written again. Sized to the building it sits
 * on - fifteen world units or so - a single rooftop halo covers half the
 * screen height from thirty metres away, and forty of them would cost several
 * whole screens of overdraw per frame: more than the bloom pass this exists to
 * replace. Kept small they are a hint of light bleeding off a surface, which
 * is all that is wanted, for a fraction of one screen in total.
 * ========================================================================= */

/** Halo diameters, in world units. Deliberately modest - see the note above. */
const TRIM_HALO = 4.2;
const LAMP_HALO = 2.6;

export function cityGlow(accent: string): GlowItem[] {
  const out: GlowItem[] = [];

  // Rooftop neon trim.
  for (const b of buildings) {
    out.push({
      pos: [b.position[0], b.position[1] + b.size[1] / 2 + 0.2, b.position[2]],
      color: b.color,
      size: TRIM_HALO,
    });
  }

  // Lamp heads along the boulevard.
  for (const p of PROPS) {
    if (p.kind !== 'lamp') continue;
    out.push({ pos: [p.x, 4.85, p.z], color: accent, size: LAMP_HALO });
  }

  return out;
}

export function stationGlow(accent: string): GlowItem[] {
  const out: GlowItem[] = [];

  for (const b of buildings) {
    out.push({
      pos: [b.position[0], b.position[1] + b.size[1] / 2 + 0.2, b.position[2]],
      color: b.color,
      size: TRIM_HALO * 0.8,
    });
  }

  for (const p of PROPS) {
    if (p.kind !== 'lamp') continue;
    out.push({ pos: [p.x, 2.28, p.z], color: accent, size: LAMP_HALO });
  }

  return out;
}

export function ruinGlow(): GlowItem[] {
  // Only the braziers: daylight needs no help, and haloing the stonework would
  // read as fog rather than light.
  return PROPS.filter((p) => p.kind === 'lamp').map((p) => ({
    pos: [p.x, 3.7, p.z] as Vec3,
    color: '#ff9d3d',
    size: LAMP_HALO * 1.2,
  }));
}

/* Dev-only budget report, so it is obvious if a change here ever stops being
   the cheap kind of detail it is supposed to be. */
if (import.meta.env.DEV) {
  const total =
    cityWindows.length +
    stationGreebles.length +
    stationLights.length +
    ruinRubble.length +
    ruinCourses.length;
  console.info(
    `[portfolio] decor: ${cityWindows.length} windows, ${stationGreebles.length} greebles, ` +
      `${ruinRubble.length} rubble, ${ruinCourses.length} courses ` +
      `(${total} instances total, drawn in 5 instanced meshes).`,
  );
}
