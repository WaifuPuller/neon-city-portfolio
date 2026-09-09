import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { buildings, PROPS, WORLD_BOUNDS } from '../../systems/world';
import { QualityProfile } from '../../utils/device';
import {
  compoundBands,
  compoundCover,
  compoundRoofs,
  compoundWindows,
} from '../../systems/decor';
import { Decor } from './Decor';

/* ===========================================================================
 * THE DROP ZONE
 *
 * An abandoned military settlement under a flat overcast sky, in the visual
 * language of the battle-royale genre: concrete compounds, corrugated roofing,
 * supply crates, utility poles, and a containment wall drawing in around the
 * edge of the map.
 *
 * Everything here is original geometry generated from the same world.ts data
 * every other setting uses. No assets, maps, marks or layouts are taken from
 * any existing game.
 *
 * The hard part of this one is the light. The other four are lit by things
 * INSIDE them - neon, a sun, lanterns - so they have obvious contrast. An
 * overcast day has none: one enormous soft source, almost nothing in true
 * shadow, and colour doing all the work. Get that wrong and it reads as a grey
 * screen rather than as daylight.
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
  varying vec3 vPos;

  // NOTE: smoothstep() with edge0 > edge1 is undefined in GLSL, so every
  // descending ramp here is written as 1.0 - smoothstep(lo, hi, x).

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec3 dir = normalize(vPos);
    float h = dir.y;

    // Brighter at the horizon than overhead, which is what an overcast sky
    // actually does and the main thing that stops it reading as flat grey.
    vec3 col = mix(uLow, uHigh, smoothstep(0.0, 0.75, h));

    /* Broken cloud. Two octaves is affordable here because, unlike the ground,
       the sky is mostly hidden behind buildings and is never more than a
       fraction of the screen. */
    vec2 uvSky = dir.xz / max(0.16, abs(h) + 0.3);
    float cloud = noise(uvSky * 1.4) * 0.6 + noise(uvSky * 3.1) * 0.4;
    col = mix(col, col * 1.16, smoothstep(0.42, 0.78, cloud) * smoothstep(0.0, 0.35, h));
    col = mix(col, col * 0.88, smoothstep(0.5, 0.85, 1.0 - cloud) * smoothstep(0.0, 0.4, h));

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const Sky: React.FC = () => {
  const uniforms = useMemo(
    () => ({
      uHigh: { value: new THREE.Color('#9fa9b4') },
      uLow: { value: new THREE.Color('#cfd2c8') },
    }),
    [],
  );

  return (
    <mesh scale={[-1, 1, 1]} position={[0, 0, 30]}>
      <sphereGeometry args={[260, 24, 16]} />
      <shaderMaterial
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
 * TERRAIN
 * Dry grass and bare earth, with a dirt track where the boulevard runs.
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
  uniform vec3 uGrass;
  uniform vec3 uDirt;
  uniform vec3 uTrack;
  varying vec2 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    /* Patchy ground cover. Cheap crossed sines for the big shapes plus a
       per-cell hash for the grain, rather than several octaves of noise on
       every pixel of a plane that fills most of the screen. */
    // NB: not named 'patch' - that is a reserved word in GLSL ES 3.0 and the
    // shader will not compile if this ever runs under a #version 300 es header.
    float spread = sin(vWorld.x * 0.08 + 1.3) * sin(vWorld.y * 0.07 - 0.9)
                 + 0.5 * sin(vWorld.x * 0.21 - 2.4) * sin(vWorld.y * 0.19 + 0.6);
    float grass = smoothstep(-0.25, 0.55, spread);

    // Grain, so the big areas do not look like airbrushed blobs.
    float grain = hash(floor(vWorld * 1.6)) * 0.16;

    // The track down the middle, worn through to bare earth, with ruts.
    float track = 1.0 - smoothstep(4.2, 7.4, abs(vWorld.x));
    float ruts = (1.0 - smoothstep(0.0, 0.45, abs(abs(vWorld.x) - 2.1))) * track;

    float dist = length(vWorld);
    float falloff = 1.0 - smoothstep(30.0, 130.0, dist);

    vec3 col = mix(uDirt, uGrass, grass);
    col += grain - 0.08;
    col = mix(col, uTrack, track * 0.85);
    col = mix(col, uTrack * 0.82, ruts * 0.6);

    // Haze washing the distance out, so the far edge does not end abruptly.
    col = mix(col * 1.05, vec3(0.60, 0.61, 0.55), 1.0 - falloff);

    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    #include <colorspace_fragment>
  }
`;

const Ground: React.FC = () => {
  const uniforms = useMemo(
    () => ({
      uGrass: { value: new THREE.Color('#6f7a4a') },
      uDirt: { value: new THREE.Color('#8b7c5c') },
      uTrack: { value: new THREE.Color('#9c8b6a') },
    }),
    [],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 30]} receiveShadow>
      <planeGeometry args={[420, 420]} />
      <shaderMaterial uniforms={uniforms} vertexShader={groundVertex} fragmentShader={groundFragment} />
    </mesh>
  );
};

/* ===========================================================================
 * COMPOUNDS
 * ========================================================================= */

const Compounds: React.FC<{ detail: boolean; shadows: boolean }> = ({ detail, shadows }) => {
  const stacks = useMemo(() => buildings.filter((b) => b.spire > 0), []);

  return (
    <group>
      {/* Poured concrete, weathered. Rough and barely metallic, so the overcast
          key light wraps around it instead of glinting. */}
      <Instances limit={buildings.length} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry />
        <meshStandardMaterial color="#9c9689" roughness={0.93} metalness={0.03} />
        {buildings.map((b) => (
          <Instance key={b.id} position={b.position} scale={b.size} />
        ))}
      </Instances>

      {/* A painted lower storey, the way these buildings always are. */}
      <Instances limit={buildings.length} castShadow={shadows}>
        <boxGeometry />
        <meshStandardMaterial color="#7d8468" roughness={0.9} metalness={0.03} />
        {buildings.map((b) => (
          <Instance
            key={b.id}
            position={[b.position[0], b.position[1] - b.size[1] / 2 + 1.7, b.position[2]]}
            scale={[b.size[0] + 0.2, 3.4, b.size[2] + 0.2]}
          />
        ))}
      </Instances>

      {/* Rusted stacks and radio masts on the taller blocks. */}
      {detail && (
        <Instances limit={Math.max(1, stacks.length)} castShadow={shadows}>
          <cylinderGeometry args={[0.28, 0.34, 1, 8]} />
          <meshStandardMaterial color="#7a5c46" roughness={0.9} metalness={0.25} />
          {stacks.map((b) => (
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
 * FIELD KIT
 * Utility poles, supply crates and barriers.
 * ========================================================================= */

const FieldProps: React.FC = () => {
  const poles = useMemo(() => PROPS.filter((p) => p.kind === 'lamp'), []);
  const crates = useMemo(() => PROPS.filter((p) => p.kind === 'crate'), []);
  const barriers = useMemo(() => PROPS.filter((p) => p.kind === 'sign'), []);

  return (
    <group>
      {/* Utility poles */}
      <Instances limit={Math.max(1, poles.length)} castShadow>
        <cylinderGeometry args={[0.13, 0.17, 1, 6]} />
        <meshStandardMaterial color="#6b5a45" roughness={0.94} metalness={0.02} />
        {poles.map((p, i) => (
          <Instance key={i} position={[p.x, 3.1, p.z]} scale={[1, 6.2, 1]} />
        ))}
      </Instances>

      {/* Crossarm, which is what makes a pole read as a pole. */}
      <Instances limit={Math.max(1, poles.length)}>
        <boxGeometry />
        <meshStandardMaterial color="#6b5a45" roughness={0.94} metalness={0.02} />
        {poles.map((p, i) => (
          <Instance key={i} position={[p.x, 5.6, p.z]} scale={[2.2, 0.16, 0.16]} />
        ))}
      </Instances>

      {/* Supply crates */}
      <Instances limit={Math.max(1, crates.length)} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#4e5a3a" roughness={0.88} metalness={0.06} />
        {crates.map((p, i) => (
          <Instance key={i} position={[p.x, 0.62, p.z]} rotation={[0, p.rot, 0]} scale={[1.5, 1.24, 1.2]} />
        ))}
      </Instances>

      {/* The orange band, so a crate is spottable across a field. */}
      <Instances limit={Math.max(1, crates.length)}>
        <boxGeometry />
        <meshStandardMaterial color="#c9622a" roughness={0.7} metalness={0.05} />
        {crates.map((p, i) => (
          <Instance key={i} position={[p.x, 0.62, p.z]} rotation={[0, p.rot, 0]} scale={[1.56, 0.3, 1.26]} />
        ))}
      </Instances>

      {/* Concrete barriers */}
      <Instances limit={Math.max(1, barriers.length)} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#a8a294" roughness={0.92} metalness={0.03} />
        {barriers.map((p, i) => (
          <Instance key={i} position={[p.x, 0.55, p.z]} rotation={[0, p.rot, 0]} scale={[2.4, 1.1, 0.7]} />
        ))}
      </Instances>
    </group>
  );
};

/* ===========================================================================
 * DUST
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
    p.x += sin(uTime * 0.24 + aOffset) * 2.6;
    p.z += cos(uTime * 0.19 + aOffset * 1.5) * 2.6;

    float t = rise / uHeight;
    vAlpha = smoothstep(0.0, 0.16, t) * (1.0 - smoothstep(0.55, 1.0, t));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (46.0 / -mv.z) * (0.8 + aSpeed * 0.4);
    gl_Position = projectionMatrix * mv;
  }
`;

const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.0, 0.5, d)) * vAlpha * 0.34;
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
      speeds[i] = 0.4 + Math.random() * 1.0;
      offsets[i] = Math.random() * 22;
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
      uHeight: { value: 22 },
      uColor: { value: new THREE.Color('#e8e2cd') },
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
      />
    </points>
  );
};

/* ===========================================================================
 * CONTAINMENT WALL
 *
 * The edge of the play area, drawn as the shrinking-circle wall the genre uses
 * - a nod to the convention rather than a copy of anyone's implementation, and
 * a far better answer to "why can I not walk further?" than an invisible stop.
 * ========================================================================= */

const wallVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const wallFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uAspect;
  varying vec2 vUv;

  void main() {
    // Vertical filaments running up the wall.
    float strands = abs(fract(vUv.x * uAspect * 26.0) - 0.5) * 2.0;
    float filament = 1.0 - smoothstep(0.55, 1.0, strands);

    // Solid at the ground, thinning towards the top.
    float rise = 1.0 - smoothstep(0.0, 0.95, vUv.y);

    // Energy climbing the wall.
    float surge = smoothstep(0.80, 1.0, sin(vUv.y * 7.0 - uTime * 2.1) * 0.5 + 0.5);

    float a = (0.10 + filament * 0.20 + surge * 0.22) * rise;
    gl_FragColor = vec4(uColor, a);
  }
`;

const ContainmentWall: React.FC = () => {
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const HEIGHT = 26;

  const walls: { pos: [number, number, number]; size: [number, number]; rot: number }[] = [
    { pos: [cx, HEIGHT / 2, minZ], size: [w, HEIGHT], rot: 0 },
    { pos: [cx, HEIGHT / 2, maxZ], size: [w, HEIGHT], rot: 0 },
    { pos: [minX, HEIGHT / 2, cz], size: [d, HEIGHT], rot: Math.PI / 2 },
    { pos: [maxX, HEIGHT / 2, cz], size: [d, HEIGHT], rot: Math.PI / 2 },
  ];

  const materials = useRef<(THREE.ShaderMaterial | null)[]>([]);

  useFrame((state) => {
    for (const m of materials.current) {
      if (m) m.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group>
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.pos} rotation={[0, wall.rot, 0]}>
          <planeGeometry args={wall.size} />
          <shaderMaterial
            ref={(m) => {
              materials.current[i] = m;
            }}
            uniforms={{
              uColor: { value: new THREE.Color('#4fb8ff') },
              uTime: { value: 0 },
              uAspect: { value: wall.size[0] / wall.size[1] },
            }}
            vertexShader={wallVertex}
            fragmentShader={wallFragment}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
};

/* ========================================================================= */

interface Props {
  profile: QualityProfile;
  primary: string;
  accent: string;
  glow: string;
}

export const Battleground: React.FC<Props> = ({ profile }) => (
  <group>
    <Sky />
    <Ground />
    <Compounds detail={profile.detail} shadows={profile.shadows} />

    {profile.detail && (
      <Decor items={compoundBands} shape="box" color="#8a8478" roughness={0.92} metalness={0.03} />
    )}
    {profile.detail && (
      <Decor items={compoundRoofs} shape="box" color="#8f897c" roughness={0.92} metalness={0.04} />
    )}
    {/* Window openings are dark holes, not lights: in daylight that is what a
        window on an empty building actually looks like. */}
    {profile.detail && <Decor items={compoundWindows} color="#2b2c28" roughness={1} metalness={0} />}
    {profile.detail && (
      <Decor items={compoundCover} shape="box" color="#7c7360" roughness={0.95} metalness={0.02} />
    )}
    {profile.detail && <FieldProps />}

    {profile.particles > 0 && <Dust count={Math.round(profile.particles * 0.5)} />}
    <ContainmentWall />
  </group>
);
