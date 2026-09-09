import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { buildings, PROPS, WORLD_BOUNDS } from '../../systems/world';
import { QualityProfile } from '../../utils/device';
import { districtBanners, districtGlow, districtWindows } from '../../systems/decor';
import { Decor, Glow } from './Decor';

/* ===========================================================================
 * LANTERN DISTRICT
 *
 * A narrow shopping street after closing. Same source data as every other
 * world, so collision, routing and the maps are untouched.
 *
 * Deliberately warm where the neon city is cold. The two are both wet streets
 * at night and would otherwise blur into each other: this one is lit by
 * lanterns, shopfronts and vending machines rather than signage, so the
 * palette runs red-amber-cream and the light sits low, at head height, instead
 * of forty metres up on a rooftop.
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
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  varying vec3 vPos;

  // NOTE: smoothstep() with edge0 > edge1 is undefined in GLSL, so every
  // descending ramp here is written as 1.0 - smoothstep(lo, hi, x).

  void main() {
    float h = normalize(vPos).y;
    vec3 col = mix(uHorizon, uTop, smoothstep(-0.04, 0.58, h));

    // Low cloud catching the light of the street below. Overcast nights in a
    // lit-up town are brighter overhead than clear ones, not darker.
    col += uGlow * pow(max(0.0, 1.0 - abs(h) * 2.2), 2.6) * 0.5;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const Sky: React.FC<{ glow: string }> = ({ glow }) => {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#0b0712') },
      uHorizon: { value: new THREE.Color('#2a1220') },
      uGlow: { value: new THREE.Color(glow) },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Warmed towards lantern light, so a cyan theme still reads as a warm street.
  uniforms.uGlow.value.set(glow).lerp(new THREE.Color('#ff9455'), 0.55);

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
 * GROUND
 * Wet asphalt with a painted centre line and a lot of reflection.
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
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform vec3 uBase;
  uniform float uTime;
  varying vec2 vWorld;

  float band(float v, float lo, float hi) {
    return smoothstep(lo, hi, v);
  }

  void main() {
    // Paving joints across the pavements either side of the road.
    vec2 g = abs(fract(vWorld / 2.5 - 0.5) - 0.5) * 2.5;
    vec2 fw = fwidth(vWorld) + 1e-4;
    vec2 seams = 1.0 - smoothstep(0.05 - fw, 0.05 + fw, g);
    float joint = max(seams.x, seams.y);

    // The road itself, and the dashed line down the middle of it.
    float road = 1.0 - smoothstep(5.4, 6.6, abs(vWorld.x));
    float dash = step(0.55, fract(vWorld.y * 0.14)) * (1.0 - smoothstep(0.0, 0.22, abs(vWorld.x)));

    /* Standing water. Crossed sines rather than value noise, for the same
       reason as the neon city: this runs on every ground pixel on screen and
       four sin() calls is a fraction of the cost of hashed noise. */
    float water = sin(vWorld.x * 0.17 - 0.4) * sin(vWorld.y * 0.13 + 2.2)
                + 0.5 * sin(vWorld.x * 0.37 + 1.1) * sin(vWorld.y * 0.29 - 0.8);
    float wet = band(water, 0.10, 0.72);

    float dist = length(vWorld);
    float falloff = 1.0 - smoothstep(34.0, 140.0, dist);

    vec3 col = uBase;
    col += vec3(0.06, 0.05, 0.06) * joint * (1.0 - road) * falloff;
    col = mix(col, uBase * 0.72, road);

    // Wet asphalt goes darker and throws far more back.
    col *= 1.0 - wet * 0.4;

    /* The reflections. Warm from the shopfronts along the sides, cooler down
       the middle where the vending machines are - which is what makes a street
       like this read as lit from the edges rather than from above. */
    float sides = smoothstep(5.0, 14.0, abs(vWorld.x)) * (1.0 - smoothstep(14.0, 30.0, abs(vWorld.x)));
    col += uWarm * wet * sides * 0.55 * falloff;
    col += uWarm * wet * 0.13 * falloff;
    col += uCool * wet * road * 0.22 * falloff;

    // Painted line, which stays bright because paint is not wet asphalt.
    col += vec3(0.9, 0.86, 0.7) * dash * 0.5 * falloff;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const Ground: React.FC<{ accent: string }> = ({ accent }) => {
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uWarm: { value: new THREE.Color('#ff8a4c') },
      uCool: { value: new THREE.Color(accent) },
      uBase: { value: new THREE.Color('#0e0a10') },
      uTime: { value: 0 },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  uniforms.uCool.value.set(accent);

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
 * BUILDINGS
 * Plaster and tile, with a lit shopfront along the bottom of every one.
 * ========================================================================= */

const Blocks: React.FC<{ detail: boolean; shadows: boolean }> = ({ detail, shadows }) => {
  const awnings = useMemo(() => buildings.filter((b) => b.spire > 0), []);

  return (
    <group>
      <Instances limit={buildings.length} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry />
        <meshStandardMaterial color="#2b232c" roughness={0.82} metalness={0.06} />
        {buildings.map((b) => (
          <Instance key={b.id} position={b.position} scale={b.size} />
        ))}
      </Instances>

      {/* The shopfront: a glowing band around the base of every building. This
          is the whole look - a street like this is lit from its ground floor. */}
      <Instances limit={buildings.length}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} color="#ffb066" transparent opacity={0.82} />
        {buildings.map((b) => (
          <Instance
            key={b.id}
            position={[b.position[0], b.position[1] - b.size[1] / 2 + 1.5, b.position[2]]}
            scale={[b.size[0] + 0.16, 1.5, b.size[2] + 0.16]}
          />
        ))}
      </Instances>

      {/* Awning over the shopfront, on the buildings that have one. */}
      {detail && (
        <Instances limit={Math.max(1, awnings.length)}>
          <boxGeometry />
          <meshStandardMaterial color="#7d2b32" roughness={0.8} metalness={0.05} />
          {awnings.map((b) => (
            <Instance
              key={b.id}
              position={[b.position[0], b.position[1] - b.size[1] / 2 + 2.6, b.position[2]]}
              scale={[b.size[0] + 1.5, 0.28, b.size[2] + 1.5]}
            />
          ))}
        </Instances>
      )}

      {/* Tiled roof lip */}
      <Instances limit={buildings.length}>
        <boxGeometry />
        <meshStandardMaterial color="#191320" roughness={0.75} metalness={0.1} />
        {buildings.map((b) => (
          <Instance
            key={b.id}
            position={[b.position[0], b.position[1] + b.size[1] / 2 + 0.22, b.position[2]]}
            scale={[b.size[0] + 0.85, 0.44, b.size[2] + 0.85]}
          />
        ))}
      </Instances>
    </group>
  );
};

/* ===========================================================================
 * STREET
 * Lanterns on posts, vending machines, and stacked crates.
 * ========================================================================= */

const StreetProps: React.FC = () => {
  const lanterns = useMemo(() => PROPS.filter((p) => p.kind === 'lamp'), []);
  const machines = useMemo(() => PROPS.filter((p) => p.kind === 'sign'), []);
  const crates = useMemo(() => PROPS.filter((p) => p.kind === 'crate'), []);

  const glowRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    // All the lanterns breathe together. Individual phases would mean writing
    // the instance buffer every frame for something nobody consciously sees.
    if (glowRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.3) * 0.045;
      glowRef.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      {/* Posts */}
      <Instances limit={Math.max(1, lanterns.length)}>
        <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
        <meshStandardMaterial color="#241c26" roughness={0.7} metalness={0.3} />
        {lanterns.map((p, i) => (
          <Instance key={i} position={[p.x, 2.0, p.z]} scale={[1, 4.0, 1]} />
        ))}
      </Instances>

      {/* Paper lanterns */}
      <group ref={glowRef}>
        <Instances limit={Math.max(1, lanterns.length)}>
          <cylinderGeometry args={[0.42, 0.42, 1, 10]} />
          <meshBasicMaterial color="#ff7a48" toneMapped={false} transparent opacity={0.95} />
          {lanterns.map((p, i) => (
            <Instance key={i} position={[p.x, 4.3, p.z]} scale={[1, 0.62, 1]} />
          ))}
        </Instances>
      </group>

      {/* Vending machines. Their lit front is the coolest light on the street,
          which is exactly what makes the lanterns read as warm. */}
      <Instances limit={Math.max(1, machines.length)}>
        <boxGeometry />
        <meshStandardMaterial color="#1b2432" roughness={0.5} metalness={0.4} />
        {machines.map((p, i) => (
          <Instance key={i} position={[p.x, 0.95, p.z]} rotation={[0, p.rot, 0]} scale={[1.15, 1.9, 0.72]} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, machines.length)}>
        <planeGeometry />
        <meshBasicMaterial color="#bfe6ff" toneMapped={false} transparent opacity={0.88} side={THREE.DoubleSide} />
        {machines.map((p, i) => (
          <Instance
            key={i}
            position={[p.x + Math.sin(p.rot) * 0.38, 1.15, p.z + Math.cos(p.rot) * 0.38]}
            rotation={[0, p.rot, 0]}
            scale={[0.92, 1.3, 1]}
          />
        ))}
      </Instances>

      {/* Crates stacked outside the shops */}
      <Instances limit={Math.max(1, crates.length)}>
        <boxGeometry />
        <meshStandardMaterial color="#4a3a2a" roughness={0.85} metalness={0.04} />
        {crates.map((p, i) => (
          <Instance key={i} position={[p.x, 0.42, p.z]} rotation={[0, p.rot, 0]} scale={[1.1, 0.85, 0.9]} />
        ))}
      </Instances>
    </group>
  );
};

/* ===========================================================================
 * PETALS
 * Blossom coming off the trees, in place of the city's rain.
 * ========================================================================= */

const petalVertex = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  attribute float aSpeed;
  attribute float aOffset;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float fall = mod(aOffset + uTime * aSpeed, uHeight);
    p.y = uHeight - fall;

    // Petals do not drop, they wander down. Two frequencies so no two follow
    // the same line.
    p.x += sin(uTime * 0.9 + aOffset * 2.1) * 1.9 + sin(uTime * 0.31 + aOffset) * 0.9;
    p.z += cos(uTime * 0.7 + aOffset * 1.6) * 1.6;

    float t = fall / uHeight;
    vAlpha = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.82, 1.0, t));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (95.0 / -mv.z) * (0.75 + aSpeed * 0.3);
    gl_Position = projectionMatrix * mv;
  }
`;

const petalFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    // Squashed on one axis, so it reads as a petal rather than a snowflake.
    float d = length(vec2(c.x * 1.6, c.y));
    float a = (1.0 - smoothstep(0.18, 0.5, d)) * vAlpha * 0.85;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

const Petals: React.FC<{ count: number }> = ({ count }) => {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 180;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 180 + 26;
      speeds[i] = 1.4 + Math.random() * 2.2;
      offsets[i] = Math.random() * 40;
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
      uHeight: { value: 40 },
      uColor: { value: new THREE.Color('#ffc2d4') },
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
        vertexShader={petalVertex}
        fragmentShader={petalFragment}
        transparent
        depthWrite={false}
      />
    </points>
  );
};

/* ===========================================================================
 * BOUNDARY
 * Shuttered frontages closing off the end of the street.
 * ========================================================================= */

const Boundary: React.FC = () => {
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const w = maxX - minX;
  const d = maxZ - minZ;

  /* Nudged outward by half their thickness. Centred on the bound, half of
     each wall reaches into the area the player is clamped to, so the camera
     ends up inside the masonry when you walk to the edge. */
  const T = 1.2;
  const walls: { pos: [number, number, number]; scale: [number, number, number] }[] = [
    { pos: [cx, 3.2, minZ - T / 2], scale: [w + T, 6.4, T] },
    { pos: [cx, 3.2, maxZ + T / 2], scale: [w + T, 6.4, T] },
    { pos: [minX - T / 2, 3.2, cz], scale: [T, 6.4, d + T] },
    { pos: [maxX + T / 2, 3.2, cz], scale: [T, 6.4, d + T] },
  ];

  return (
    <group>
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.pos} scale={wall.scale}>
          <boxGeometry />
          <meshStandardMaterial color="#241a26" roughness={0.85} metalness={0.12} />
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

export const LanternDistrict: React.FC<Props> = ({ profile, accent, glow }) => {
  const halos = useMemo(() => districtGlow(), []);

  return (
    <group>
      <Sky glow={glow} />
      <Ground accent={accent} />
      <Blocks detail={profile.detail} shadows={profile.shadows} />

      {profile.detail && <Decor items={districtWindows} emissive />}
      {profile.detail && <Decor items={districtBanners} emissive opacity={0.92} />}
      {profile.detail && <StreetProps />}

      {profile.particles > 0 && <Petals count={Math.round(profile.particles * 0.55)} />}
      <Boundary />

      {profile.detail && !profile.bloom && <Glow items={halos} />}
    </group>
  );
};
