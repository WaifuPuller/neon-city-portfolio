import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { OrbiterKind } from '../../config/worlds';

/* ---------------------------------------------------------------------------
 * The craft that circles the map, in one shape per setting.
 *
 * A spaceship over a desert temple is silly, and the orbiter is drawn in every
 * world because it sits outside the environment switch - so rather than hide
 * it where it does not fit, it changes into something that does.
 *
 * All six read at the same distance. They are seen from 150 metres away and
 * never up close, so what matters is the SILHOUETTE: a wing line, a hanging
 * basket, a slab against the sky. Surface detail at this range is wasted, and
 * every one of these is a handful of boxes for that reason.
 * ------------------------------------------------------------------------- */

interface FormProps {
  color: string;
  /** The current theme colour, for lights and glows. */
  glow: string;
}

/* ------------------------------------------------------------- SPACESHIP --- */

const Spaceship: React.FC<FormProps> = ({ color, glow }) => (
  <group>
    {/* CapsuleGeometry runs along Y, so the fuselage has to be tipped onto Z
        to lie along the direction of travel like everything else here. */}
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <capsuleGeometry args={[1.9, 12, 6, 14]} />
      <meshStandardMaterial color={color} roughness={0.42} metalness={0.85} fog={false} />
    </mesh>
    <mesh position={[0, 1.6, 0]}>
      <boxGeometry args={[1.1, 1.5, 9]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.8} fog={false} />
    </mesh>
    {[-1, 1].map((side) => (
      <mesh key={side} position={[side * 3.4, -0.4, -1.4]} rotation={[0, 0, side * 0.22]}>
        <boxGeometry args={[5.2, 0.4, 5.4]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.8} fog={false} />
      </mesh>
    ))}
    {[-1, 1].map((side) => (
      <group key={side} position={[side * 3.4, -0.4, -4.6]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.85, 1.05, 3.4, 10]} />
          <meshStandardMaterial color="#39445a" roughness={0.35} metalness={0.9} fog={false} />
        </mesh>
        <mesh position={[0, 0, -2.0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.78, 0.3, 2.6, 10, 1, true]} />
          <meshBasicMaterial
            color={glow}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            toneMapped={false}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      </group>
    ))}
    <mesh position={[0, 1.6, 6.6]}>
      <sphereGeometry args={[0.4, 8, 6]} />
      <meshBasicMaterial color={glow} toneMapped={false} fog={false} />
    </mesh>
  </group>
);

/* -------------------------------------------------------------- ASTEROID --- */

const Asteroid: React.FC<FormProps> = ({ color }) => {
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(6.5, 2);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n =
        Math.sin(v.x * 0.9) * Math.cos(v.y * 1.1) * Math.sin(v.z * 0.7) * 0.5 +
        Math.sin(v.x * 2.3 + v.z) * 0.22;
      v.multiplyScalar(1 + n * 0.26);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.95} metalness={0.05} flatShading fog={false} />
    </mesh>
  );
};

/* ----------------------------------------------------------- HOVER BARGE --- */
/* Neon city: a slab-sided freight hauler with its cargo strapped on top and
   its underside lit, which is how you read one against a night sky. */

const HoverBarge: React.FC<FormProps> = ({ color, glow }) => (
  <group>
    {/* Deck */}
    <mesh>
      <boxGeometry args={[7.5, 1.8, 22]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.7} fog={false} />
    </mesh>

    {/* Bridge, up at the front */}
    <mesh position={[0, 2.1, 8.2]}>
      <boxGeometry args={[4.6, 2.6, 4.4]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.75} fog={false} />
    </mesh>
    <mesh position={[0, 2.3, 10.5]}>
      <boxGeometry args={[3.6, 1.2, 0.2]} />
      <meshBasicMaterial color={glow} toneMapped={false} fog={false} />
    </mesh>

    {/* Containers */}
    {[-5.2, -1.4, 2.4].map((z, i) => (
      <mesh key={z} position={[i % 2 === 0 ? -1.4 : 1.4, 2.4, z]}>
        <boxGeometry args={[3.6, 2.4, 3.2]} />
        <meshStandardMaterial
          color={i === 1 ? '#553049' : '#2c3550'}
          roughness={0.7}
          metalness={0.4}
          fog={false}
        />
      </mesh>
    ))}

    {/* Underside strip lighting - the whole silhouette at night. */}
    {[-2.6, 2.6].map((x) => (
      <mesh key={x} position={[x, -1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 20]} />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    ))}

    {/* Lift fans slung under the hull */}
    {[-7.5, 0, 7.5].map((z) =>
      [-1, 1].map((side) => (
        <mesh key={`${z}:${side}`} position={[side * 4.2, -1.1, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.35, 1.35, 1.0, 10, 1, true]} />
          <meshBasicMaterial
            color={glow}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            toneMapped={false}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      )),
    )}
  </group>
);

/* ----------------------------------------------------------- SKY LANTERN --- */
/* Lantern district: a paper balloon lit from inside, with a basket under it.
   Nothing else in that world is above head height, so this is the one thing
   the visitor ever looks up at. */

const SkyLantern: React.FC<FormProps> = ({ color }) => (
  <group>
    {/* Envelope and ribs share one scaled group, so the ribs stretch with the
        paper instead of cutting through it at the equator and vanishing inside
        it at the top. Full rings, not half ones, or the underside - the part
        you actually see from the ground - has no structure at all. */}
    <group scale={[1, 1.22, 1]}>
      {/* Basic, not standard: it is lit from within, so shading it by the
          scene's lights would make the underside read as dead. */}
      <mesh>
        <sphereGeometry args={[6.4, 20, 14]} />
        <meshBasicMaterial color="#ffb072" transparent opacity={0.92} toneMapped={false} fog={false} />
      </mesh>

      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, (i / 4) * Math.PI, 0]}>
          <torusGeometry args={[6.52, 0.11, 5, 20]} />
          <meshBasicMaterial color="#8a4a24" toneMapped={false} fog={false} />
        </mesh>
      ))}
    </group>

    {/* The flame inside, showing through the paper */}
    <mesh position={[0, -3.4, 0]}>
      <sphereGeometry args={[1.5, 10, 8]} />
      <meshBasicMaterial color="#fff0c0" toneMapped={false} fog={false} />
    </mesh>

    {/* Rigging and basket */}
    {[-1, 1].map((sx) =>
      [-1, 1].map((sz) => (
        <mesh key={`${sx}:${sz}`} position={[sx * 1.9, -8.6, sz * 1.9]}>
          <boxGeometry args={[0.12, 4.4, 0.12]} />
          <meshStandardMaterial color="#4a3728" roughness={0.9} fog={false} />
        </mesh>
      )),
    )}
    <mesh position={[0, -11.2, 0]}>
      <boxGeometry args={[4.4, 1.8, 4.4]} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} fog={false} />
    </mesh>
  </group>
);

/* -------------------------------------------------------------- MONOLITH --- */
/* Sunken ruins: a slab of carved stone adrift, with smaller pieces still
   hanging around it. Deliberately unexplained. */

const Monolith: React.FC<FormProps> = ({ color, glow }) => (
  // Turned so the carved face looks in towards the map, which is where both
  // the banner and the player are.
  <group rotation={[0, -Math.PI / 2, 0]}>
    <mesh>
      <boxGeometry args={[9, 20, 3.2]} />
      <meshStandardMaterial color={color} roughness={0.95} metalness={0.02} fog={false} />
    </mesh>

    {/* A weathered cap and base, so it is not a plain rectangle. */}
    {[10.6, -10.6].map((y) => (
      <mesh key={y} position={[0, y, 0]}>
        <boxGeometry args={[10.4, 1.4, 4.4]} />
        <meshStandardMaterial color={color} roughness={0.96} metalness={0.02} fog={false} />
      </mesh>
    ))}

    {/* Glyph lines cut into the face, faintly lit. */}
    {[6, 2, -2, -6].map((y) => (
      <mesh key={y} position={[0, y, 1.7]}>
        <planeGeometry args={[5.6, 0.5]} />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    ))}

    {/* Broken pieces still orbiting the main slab. */}
    {[
      [7.5, 6.5, 1.4],
      [-8.2, -3.5, -1.8],
      [6.2, -8.5, 2.2],
    ].map(([x, y, z], i) => (
      <mesh key={i} position={[x, y, z]} rotation={[i, i * 1.7, i * 0.6]}>
        <boxGeometry args={[2.4 - i * 0.4, 2.0, 1.8]} />
        <meshStandardMaterial color={color} roughness={0.96} metalness={0.02} fog={false} />
      </mesh>
    ))}
  </group>
);

/* -------------------------------------------------------------- DROPSHIP --- */
/* The drop zone: the supply plane doing its pass over the map. The one craft
   here that is genuinely expected to be overhead. */

const Dropship: React.FC<FormProps> = ({ color, glow }) => (
  <group>
    {/* Fuselage */}
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[2.0, 1.6, 24, 12]} />
      <meshStandardMaterial color={color} roughness={0.72} metalness={0.35} fog={false} />
    </mesh>

    {/* Nose */}
    <mesh position={[0, 0, 13.2]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[2.0, 3.4, 12]} />
      <meshStandardMaterial color={color} roughness={0.7} metalness={0.35} fog={false} />
    </mesh>

    {/* High straight wing, which is what makes it read as a transport rather
        than a fighter. */}
    <mesh position={[0, 1.9, 1.0]}>
      <boxGeometry args={[30, 0.6, 5.2]} />
      <meshStandardMaterial color={color} roughness={0.72} metalness={0.35} fog={false} />
    </mesh>

    {/* Engines under the wing */}
    {[-8.5, -4.6, 4.6, 8.5].map((x) => (
      <mesh key={x} position={[x, 0.9, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.95, 0.8, 4.4, 10]} />
        <meshStandardMaterial color="#4b5145" roughness={0.6} metalness={0.6} fog={false} />
      </mesh>
    ))}

    {/* Tail */}
    <mesh position={[0, 3.4, -10.4]}>
      <boxGeometry args={[0.5, 5.4, 4.0]} />
      <meshStandardMaterial color={color} roughness={0.72} metalness={0.35} fog={false} />
    </mesh>
    <mesh position={[0, 5.6, -10.4]}>
      <boxGeometry args={[11, 0.45, 3.2]} />
      <meshStandardMaterial color={color} roughness={0.72} metalness={0.35} fog={false} />
    </mesh>

    {/* Navigation lights */}
    {[-15, 15].map((x) => (
      <mesh key={x} position={[x, 1.9, 1.0]}>
        <sphereGeometry args={[0.42, 8, 6]} />
        <meshBasicMaterial color={x < 0 ? '#ff5a5a' : glow} toneMapped={false} fog={false} />
      </mesh>
    ))}
  </group>
);

/* ========================================================================= */

export const ORBITER_FORMS: Record<OrbiterKind, React.FC<FormProps>> = {
  spaceship: Spaceship,
  asteroid: Asteroid,
  'hover-barge': HoverBarge,
  'sky-lantern': SkyLantern,
  monolith: Monolith,
  dropship: Dropship,
};

/**
 * Where the banner hangs on each craft, and which way it faces.
 *
 * The orbiter is turned to fly along its path, which puts the map on its
 * left-hand side, so anything meant to be read from the ground has to sit out
 * that way. The lantern is the exception: its banner hangs underneath, the way
 * a real one would.
 */
export const BANNER_ANCHORS: Record<
  OrbiterKind,
  {
    position: [number, number, number];
    rotation: [number, number, number];
    /** Widest this craft can carry without the banner dwarfing it. */
    maxWidth: number;
  }
> = {
  /* Each X is set beyond that craft's widest part on the left-hand side, or
     the banner ends up buried in a wing.

       spaceship   wings sit at x -3.4 and are 5.2 across, reaching -6.0
       hover-barge lift fans at x -4.2 with radius 1.35, reaching -5.55
       monolith    3.2m deep once turned to face the map, reaching -1.6
       dropship    fuselage radius 2.0; kept off the wing above it
       lantern     hung below the basket, whose underside is at y -12.1  */
  spaceship: { position: [-6.8, 1.5, 0], rotation: [0, -Math.PI / 2, 0], maxWidth: 14 },
  asteroid: { position: [-8.6, 0, 0], rotation: [0, -Math.PI / 2, 0], maxWidth: 11 },
  'hover-barge': { position: [-6.4, 1.4, -1], rotation: [0, -Math.PI / 2, 0], maxWidth: 16 },
  'sky-lantern': { position: [-0.2, -18.4, 0], rotation: [0, -Math.PI / 2, 0], maxWidth: 15 },
  monolith: { position: [-2.6, 0, 0], rotation: [0, -Math.PI / 2, 0], maxWidth: 8 },
  dropship: { position: [-4.2, -0.8, 0], rotation: [0, -Math.PI / 2, 0], maxWidth: 16 },
};

/** How each craft carries itself in flight. */
export const FLIGHT: Record<OrbiterKind, { bank: number; tumble: boolean; bob: number }> = {
  // A ship banks into its turn.
  spaceship: { bank: 0.12, tumble: false, bob: 0 },
  asteroid: { bank: 0, tumble: true, bob: 0 },
  'hover-barge': { bank: 0.07, tumble: false, bob: 0.35 },
  // A balloon does not bank at all; it drifts and rocks.
  'sky-lantern': { bank: 0.05, tumble: false, bob: 1.1 },
  // Not tumbling: its face is carved, and a carved face should be readable.
  monolith: { bank: 0, tumble: false, bob: 0.5 },
  dropship: { bank: 0.1, tumble: false, bob: 0.2 },
};
