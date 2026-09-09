import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { buildings, PROPS, WORLD_BOUNDS } from '../../systems/world';
import { QualityProfile } from '../../utils/device';
import { ruinCourses, ruinGlow, ruinRubble } from '../../systems/decor';
import { Decor, Glow } from './Decor';

/* ===========================================================================
 * SUNKEN RUINS
 *
 * The third setting, drop-in compatible with the other two: same props, same
 * source data from world.ts, so collision, routing and both maps are
 * untouched. The city's towers become weathered stone blocks, the street
 * becomes cracked flagstones and the night becomes a low golden sun.
 *
 * Deliberately dusk rather than noon. Everything else in the game - the bloom,
 * the glowing landmark beams, the tone mapping - is built around light coming
 * OUT of the scene, and a flat midday sky washes all of that out. Golden hour
 * keeps the contrast the rest of the game needs while still reading as
 * daylight.
 * ========================================================================= */

/* ===========================================================================
 * SKY
 * ========================================================================= */

const skyVertex = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uHigh;
  uniform vec3 uLow;
  uniform vec3 uSun;
  uniform float uTime;
  varying vec3 vPos;

  // NOTE: smoothstep() with edge0 > edge1 is undefined in GLSL, so every
  // descending ramp here is written as 1.0 - smoothstep(lo, hi, x).

  void main() {
    vec3 dir = normalize(vPos);
    float h = dir.y;

    // Deep blue overhead falling to a hot, dusty band at the horizon.
    vec3 col = mix(uLow, uHigh, smoothstep(-0.02, 0.55, h));

    /* Haze thickening towards the ground, which is what sells the distance.
       Kept well under the horizon colour it sits on top of: at 0.42 it was
       adding a second full-strength orange to a horizon that was already
       orange, and the band went pure white before the sun was even drawn. */
    col += uLow * (1.0 - smoothstep(0.0, 0.30, abs(h))) * 0.18;

    /* The sun itself, low and to one side, matching the key light. Tight
       falloffs: a broad one does not read as a sun, it reads as the whole sky
       being on fire. */
    vec3 sunDir = normalize(vec3(-0.86, 0.23, 0.48));
    float toSun = max(0.0, dot(dir, sunDir));
    col += uSun * pow(toSun, 14.0) * 0.26;
    col += uSun * pow(toSun, 110.0) * 0.5;
    col += vec3(1.0, 0.96, 0.88) * pow(toSun, 1600.0) * 1.5;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const Sky: React.FC<{ glow: string }> = ({ glow }) => {
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uHigh: { value: new THREE.Color('#22395e') },
      uLow: { value: new THREE.Color('#8a4f26') },
      uSun: { value: new THREE.Color('#ffcf94') },
      uTime: { value: 0 },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // The theme colour tints the haze, so the four palettes still feel distinct
  // here without turning the sky into something the sun could not produce.
  uniforms.uHigh.value.set(glow).lerp(new THREE.Color('#22395e'), 0.78);

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh scale={[-1, 1, 1]} position={[0, 0, 30]}>
      <sphereGeometry args={[260, 32, 20]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={skyVertex}
        fragmentShader={skyFragment}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
};

/* ===========================================================================
 * GROUND
 * Cracked flagstones with a worn processional way down the middle.
 * ========================================================================= */

const groundVertex = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const groundFragment = /* glsl */ `
  uniform vec3 uStone;
  uniform vec3 uSand;
  uniform vec3 uPath;
  uniform float uTime;
  varying vec2 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float joint(vec2 p, float spacing, float thickness) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
    vec2 fw = fwidth(p) + 1e-4;
    vec2 line = 1.0 - smoothstep(thickness - fw, thickness + fw, g);
    return max(line.x, line.y);
  }

  void main() {
    // Every flagstone a slightly different shade, so the floor is not a
    // repeating tile the eye can lock onto.
    vec2 cell = floor(vWorld / 4.0);
    float shade = 0.86 + hash(cell) * 0.28;

    float joints = joint(vWorld, 4.0, 0.07);
    float slabs = joint(vWorld, 16.0, 0.14);

    // The worn path, where a thousand years of feet have polished the stone.
    float path = 1.0 - smoothstep(5.0, 9.0, abs(vWorld.x));

    // Sand drifting over everything, heavier away from the path.
    float drift = hash(floor(vWorld / 2.5)) * 0.5 + 0.5;
    float sand = drift * (0.25 + 0.55 * smoothstep(6.0, 26.0, abs(vWorld.x)));

    float dist = length(vWorld);
    float falloff = 1.0 - smoothstep(40.0, 150.0, dist);

    vec3 col = uStone * shade;
    col = mix(col, uPath, path * 0.34);
    col = mix(col, uSand, sand);

    // Mortar lines read as shadow, so they darken rather than lighten.
    col -= joints * 0.055 * falloff;
    col -= slabs * 0.075 * falloff;

    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    #include <colorspace_fragment>
  }
`;

const Ground: React.FC = () => {
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uStone: { value: new THREE.Color('#7a6249') },
      uSand: { value: new THREE.Color('#a1855f') },
      uPath: { value: new THREE.Color('#8d7458') },
      uTime: { value: 0 },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 30]} receiveShadow>
      <planeGeometry args={[420, 420]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={groundVertex}
        fragmentShader={groundFragment}
      />
    </mesh>
  );
};

/* ===========================================================================
 * RUINS
 * The same boxes, dressed as masonry: a plinth, a weathered body and a
 * broken cap, plus columns where the city had antennae.
 * ========================================================================= */

const Ruins: React.FC<{ detail: boolean; shadows: boolean }> = ({ detail, shadows }) => {
  const columns = useMemo(() => buildings.filter((b) => b.spire > 0), []);

  return (
    <group>
      {/* Main masses */}
      <Instances limit={buildings.length} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry />
        <meshStandardMaterial color="#8a7053" roughness={0.94} metalness={0.02} />
        {buildings.map((b) => (
          <Instance key={b.id} position={b.position} scale={b.size} />
        ))}
      </Instances>

      {/* Plinth: a wider, darker course at the base of every block. */}
      <Instances limit={buildings.length} castShadow={shadows}>
        <boxGeometry />
        <meshStandardMaterial color="#5f4c37" roughness={0.96} metalness={0.02} />
        {buildings.map((b) => (
          <Instance
            key={b.id}
            position={[b.position[0], b.position[1] - b.size[1] / 2 + 0.9, b.position[2]]}
            scale={[b.size[0] + 0.7, 1.8, b.size[2] + 0.7]}
          />
        ))}
      </Instances>

      {/* Broken cap: offset and undersized, so no two tops line up and the
          skyline reads as ruined rather than built. */}
      {detail && (
        <Instances limit={buildings.length} castShadow={shadows}>
          <boxGeometry />
          <meshStandardMaterial color="#9c8163" roughness={0.92} metalness={0.02} />
          {buildings.map((b) => (
            <Instance
              key={b.id}
              position={[
                b.position[0] + Math.sin(b.phase) * b.size[0] * 0.16,
                b.position[1] + b.size[1] / 2 + 0.5,
                b.position[2] + Math.cos(b.phase) * b.size[2] * 0.16,
              ]}
              rotation={[0, b.phase, 0]}
              scale={[b.size[0] * 0.82, 1.1, b.size[2] * 0.82]}
            />
          ))}
        </Instances>
      )}

      {/* Standing columns, where the city had rooftop antennae. */}
      {detail && (
        <Instances limit={Math.max(1, columns.length)} castShadow={shadows}>
          <cylinderGeometry args={[0.55, 0.68, 1, 10]} />
          <meshStandardMaterial color="#a89070" roughness={0.9} metalness={0.02} />
          {columns.map((b) => (
            <Instance
              key={b.id}
              position={[b.position[0], b.position[1] + b.size[1] / 2 + b.spire / 2, b.position[2]]}
              scale={[1, b.spire, 1]}
            />
          ))}
        </Instances>
      )}
    </group>
  );
};

/* ===========================================================================
 * PROPS
 * Braziers, fallen blocks and carved steles.
 * ========================================================================= */

const RuinProps: React.FC<{ accent: string }> = ({ accent }) => {
  const braziers = useMemo(() => PROPS.filter((p) => p.kind === 'lamp'), []);
  const blocks = useMemo(() => PROPS.filter((p) => p.kind === 'crate'), []);
  const steles = useMemo(() => PROPS.filter((p) => p.kind === 'sign'), []);

  const flame = useRef<THREE.InstancedMesh>(null);

  useFrame((state) => {
    // A slow flicker across all the braziers at once. Individual timing would
    // mean touching the matrix buffer every frame for a detail nobody reads.
    if (flame.current) {
      const t = state.clock.elapsedTime;
      const s = 1 + Math.sin(t * 7.0) * 0.08 + Math.sin(t * 11.3) * 0.05;
      flame.current.scale.set(s, s * 1.1, s);
    }
  });

  return (
    <group>
      {/* Brazier columns, lining the processional way. */}
      <Instances limit={Math.max(1, braziers.length)} castShadow>
        <cylinderGeometry args={[0.34, 0.46, 1, 8]} />
        <meshStandardMaterial color="#7d6549" roughness={0.93} metalness={0.02} />
        {braziers.map((p, i) => (
          <Instance key={i} position={[p.x, 1.5, p.z]} scale={[1, 3, 1]} />
        ))}
      </Instances>

      {/* The bowl on top */}
      <Instances limit={Math.max(1, braziers.length)}>
        <cylinderGeometry args={[0.62, 0.36, 1, 8]} />
        <meshStandardMaterial color="#5f4c37" roughness={0.9} metalness={0.05} />
        {braziers.map((p, i) => (
          <Instance key={i} position={[p.x, 3.25, p.z]} scale={[1, 0.55, 1]} />
        ))}
      </Instances>

      {/* Fire. Emissive so the bloom picks it up the way it does the neon. */}
      <group ref={flame as never}>
        <Instances limit={Math.max(1, braziers.length)}>
          <sphereGeometry args={[0.42, 8, 6]} />
          <meshBasicMaterial color="#ff9d3d" toneMapped={false} transparent opacity={0.9} />
          {braziers.map((p, i) => (
            <Instance key={i} position={[p.x, 3.7, p.z]} />
          ))}
        </Instances>
      </group>

      {/* Fallen blocks */}
      <Instances limit={Math.max(1, blocks.length)} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#8a7053" roughness={0.95} metalness={0.02} />
        {blocks.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 0.45, p.z]}
            rotation={[0.06, p.rot, 0.04]}
            scale={[1.6, 0.9, 1.2]}
          />
        ))}
      </Instances>

      {/* Carved steles, where the city had signage. */}
      <Instances limit={Math.max(1, steles.length)} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#94795b" roughness={0.92} metalness={0.02} />
        {steles.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 1.7, p.z]}
            rotation={[0, p.rot, 0]}
            scale={[1.3, 3.4, 0.34]}
          />
        ))}
      </Instances>

      {/* A faint glyph glow on each stele, so they are not dead grey slabs. */}
      <Instances limit={Math.max(1, steles.length)}>
        <planeGeometry />
        <meshBasicMaterial
          color={accent}
          toneMapped={false}
          transparent
          opacity={0.32}
          side={THREE.DoubleSide}
        />
        {steles.map((p, i) => (
          <Instance
            key={i}
            position={[p.x + Math.sin(p.rot) * 0.19, 1.9, p.z + Math.cos(p.rot) * 0.19]}
            rotation={[0, p.rot, 0]}
            scale={[0.85, 2.2, 1]}
          />
        ))}
      </Instances>
    </group>
  );
};

/* ===========================================================================
 * DUST
 * Motes hanging in the shafts of low sun.
 * ========================================================================= */

const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  attribute float aSpeed;
  attribute float aOffset;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float rise = mod(aOffset + uTime * aSpeed, uHeight);
    p.y = rise;
    p.x += sin(uTime * 0.22 + aOffset) * 2.1;
    p.z += cos(uTime * 0.17 + aOffset * 1.4) * 2.1;

    float t = rise / uHeight;
    vAlpha = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.5, 1.0, t));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (52.0 / -mv.z) * (0.8 + aSpeed * 0.4);
    gl_Position = projectionMatrix * mv;
  }
`;

const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.0, 0.5, d)) * vAlpha * 0.5;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

const Dust: React.FC<{ count: number }> = ({ count }) => {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 190;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 190 + 26;
      speeds[i] = 0.35 + Math.random() * 1.1;
      offsets[i] = Math.random() * 26;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
    return geo;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHeight: { value: 26 },
      uColor: { value: new THREE.Color('#ffdcae') },
    }),
    [],
  );

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={dustVertex}
        fragmentShader={dustFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

type Vec3Tuple = [number, number, number];

/* ===========================================================================
 * BOUNDARY
 * A ruined perimeter wall rather than a glowing field.
 * ========================================================================= */

const Boundary: React.FC = () => {
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  /* Broken into merlons of varying height, so the edge of the map reads as a
     collapsing wall instead of an obvious invisible barrier. */
  const blocks = useMemo(() => {
    const out: { pos: Vec3Tuple; scale: Vec3Tuple }[] = [];
    const STEP = 5;

    const run = (
      from: number,
      to: number,
      axis: 'x' | 'z',
      fixed: number,
      seed: number,
    ) => {
      for (let t = from; t <= to; t += STEP) {
        const wobble = Math.sin(t * 0.7 + seed) * 0.5 + 0.5;
        const h = 2.2 + wobble * 3.4;
        out.push({
          pos: axis === 'x' ? [t, h / 2, fixed] : [fixed, h / 2, t],
          scale: axis === 'x' ? [STEP + 0.4, h, 2.4] : [2.4, h, STEP + 0.4],
        });
      }
    };

    run(minX, maxX, 'x', minZ, 0);
    run(minX, maxX, 'x', maxZ, 1.7);
    run(minZ, maxZ, 'z', minX, 3.1);
    run(minZ, maxZ, 'z', maxX, 4.6);
    return out;
  }, [minX, maxX, minZ, maxZ]);

  return (
    <Instances limit={blocks.length} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial color="#7a6247" roughness={0.95} metalness={0.02} />
      {blocks.map((b, i) => (
        <Instance key={i} position={b.pos} scale={b.scale} />
      ))}
    </Instances>
  );
};

/* ========================================================================= */

interface Props {
  profile: QualityProfile;
  primary: string;
  accent: string;
  glow: string;
}

export const AncientRuins: React.FC<Props> = ({ profile, accent, glow }) => {
  const halos = useMemo(() => ruinGlow(), []);

  return (
    <group>
      <Sky glow={glow} />
      <Ground />
      <Ruins detail={profile.detail} shadows={profile.shadows} />

      {/* Weathered courses banding the walls, and fallen stone banked against
          the base so nothing meets the ground at a clean right angle. */}
      {profile.detail && (
        <Decor items={ruinCourses} shape="box" color="#6d573f" roughness={0.95} metalness={0.02} />
      )}
      {profile.detail && (
        <Decor
          items={ruinRubble}
          shape="box"
          color="#846c50"
          roughness={0.96}
          metalness={0.02}
          castShadow={profile.shadows}
        />
      )}

      {profile.detail && <RuinProps accent={accent} />}
      {profile.particles > 0 && <Dust count={Math.round(profile.particles * 0.6)} />}
      <Boundary />

      {profile.detail && !profile.bloom && <Glow items={halos} />}
    </group>
  );
};
