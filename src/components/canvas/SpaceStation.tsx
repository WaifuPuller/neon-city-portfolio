import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { buildings, PROPS, WORLD_BOUNDS } from '../../systems/world';
import { QualityProfile } from '../../utils/device';

/* ===========================================================================
 * ORBITAL STATION
 *
 * An alternative setting, drop-in compatible with NeonCity: same props, same
 * source data. The city's towers become station modules, the wet street
 * becomes a plated deck, the rain becomes drifting motes and the night sky
 * becomes open space.
 *
 * Nothing outside this file knows which setting is running. Collision,
 * routing, both maps and every quest read `world.ts`, which describes only
 * where things are SOLID - so the whole game works identically either way.
 * ========================================================================= */

/* ===========================================================================
 * SPACE
 * Stars, nebula and a distant sun, all procedural. A star texture big enough
 * not to look tiled would be several megabytes; this is a few hundred bytes.
 * ========================================================================= */

const spaceVertex = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const spaceFragment = /* glsl */ `
  uniform vec3 uNebulaA;
  uniform vec3 uNebulaB;
  uniform vec3 uSun;
  uniform float uTime;
  varying vec3 vPos;

  // NOTE: smoothstep() with edge0 > edge1 is undefined in GLSL, so every
  // descending ramp here is written as 1.0 - smoothstep(lo, hi, x).

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  /* Stars live one to a cell of a 3D grid laid over the view direction, which
     gives an even spread with no repetition and no texture lookup. */
  float starLayer(vec3 dir, float scale, float density, float size, float time) {
    vec3 g = dir * scale;
    vec3 id = floor(g);
    vec3 f = fract(g) - 0.5;

    float h = hash13(id);
    if (h < density) return 0.0;

    vec3 jitter = vec3(hash13(id + 11.0), hash13(id + 23.0), hash13(id + 37.0)) - 0.5;
    float d = length(f - jitter * 0.6);

    float bright = (h - density) / max(1e-4, 1.0 - density);
    float twinkle = 0.72 + 0.28 * sin(time * 1.6 + h * 43.0);
    return (1.0 - smoothstep(0.0, size, d)) * bright * twinkle;
  }

  void main() {
    vec3 dir = normalize(vPos);

    // Deep space, very slightly blue rather than pure black.
    vec3 col = vec3(0.012, 0.016, 0.032);

    /* Two broad clouds of gas, placed by direction so they sit still.
       Deliberately spread away from each other AND from the sun below: with
       the first cloud sitting on top of the sun, that whole quarter of the sky
       washed out into a flat bright smear once bloom got hold of it. */
    float a = pow(max(0.0, dot(dir, normalize(vec3(-0.55, 0.25, 0.80)))), 3.2);
    float b = pow(max(0.0, dot(dir, normalize(vec3(-0.75, -0.10, -0.65)))), 4.0);
    col += uNebulaA * a * 0.34;
    col += uNebulaB * b * 0.26;

    // Three layers of stars: many faint, few bright.
    col += vec3(0.62, 0.70, 0.95) * starLayer(dir, 140.0, 0.955, 0.075, uTime) * 0.9;
    col += vec3(0.85, 0.90, 1.00) * starLayer(dir,  70.0, 0.972, 0.090, uTime) * 1.3;
    col += vec3(1.00, 0.94, 0.82) * starLayer(dir,  34.0, 0.988, 0.110, uTime) * 1.8;

    /* A distant sun low on one side, giving the scene a light direction that
       matches the key light. A tight halo, not a broad one - anything wider
       reads as haze, and space has none. */
    float toSun = max(0.0, dot(dir, normalize(vec3(0.62, 0.16, -0.75))));
    col += uSun * pow(toSun, 30.0) * 0.11;
    col += vec3(1.0) * pow(toSun, 220.0) * 1.8;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const Space: React.FC<{ glow: string; accent: string }> = ({ glow, accent }) => {
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uNebulaA: { value: new THREE.Color(glow) },
      uNebulaB: { value: new THREE.Color(accent) },
      uSun: { value: new THREE.Color('#ffd9a8') },
      uTime: { value: 0 },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  uniforms.uNebulaA.value.set(glow);
  uniforms.uNebulaB.value.set(accent);

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh scale={[-1, 1, 1]} position={[0, 0, 30]}>
      <sphereGeometry args={[260, 32, 20]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={spaceVertex}
        fragmentShader={spaceFragment}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
};

/* ===========================================================================
 * DECK
 * Plated floor with a lit landing lane down the middle, in place of the
 * city's boulevard. Same idea, different vocabulary.
 * ========================================================================= */

const deckVertex = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const deckFragment = /* glsl */ `
  uniform vec3 uPanel;
  uniform vec3 uLane;
  uniform vec3 uBase;
  uniform float uTime;
  varying vec2 vWorld;

  float seam(vec2 p, float spacing, float thickness) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
    vec2 fw = fwidth(p) + 1e-4;
    vec2 line = 1.0 - smoothstep(thickness - fw, thickness + fw, g);
    return max(line.x, line.y);
  }

  void main() {
    // Hull plating: small panels inside larger structural bays.
    float panel = seam(vWorld, 5.0, 0.045);
    float bay = seam(vWorld, 25.0, 0.13);

    // The landing lane, running the length of the station.
    float lane = 1.0 - smoothstep(6.0, 8.0, abs(vWorld.x));

    // Guide lights running away down the lane.
    float run = smoothstep(0.90, 1.0, sin(vWorld.y * 0.32 - uTime * 5.0) * 0.5 + 0.5);

    // Hazard stripes marking the lane edges.
    float edge = 1.0 - smoothstep(0.0, 0.30, abs(abs(vWorld.x) - 7.2));

    float dist = length(vWorld);
    float falloff = 1.0 - smoothstep(40.0, 155.0, dist);

    vec3 col = uBase;
    col += uPanel * panel * 0.085 * falloff;
    col += uPanel * bay * 0.20 * falloff;
    col += uLane * lane * 0.030 * falloff;
    col += uLane * lane * run * 0.62 * falloff;
    col += uLane * edge * 0.38 * falloff;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const Deck: React.FC<{ primary: string; accent: string }> = ({ primary, accent }) => {
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uPanel: { value: new THREE.Color(primary) },
      uLane: { value: new THREE.Color(accent) },
      uBase: { value: new THREE.Color('#0a0c13') },
      uTime: { value: 0 },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  uniforms.uPanel.value.set(primary);
  uniforms.uLane.value.set(accent);

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 30]} receiveShadow>
      <planeGeometry args={[420, 420]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={deckVertex}
        fragmentShader={deckFragment}
      />
    </mesh>
  );
};

/* ===========================================================================
 * MODULES
 * The same boxes the city draws as towers, dressed as station hardware.
 * Four instanced meshes, so the draw call count does not move.
 * ========================================================================= */

const Modules: React.FC<{ detail: boolean; shadows: boolean }> = ({ detail, shadows }) => {
  /** Lit viewport strips wrapping two faces of each module. */
  const viewports = useMemo(() => {
    const out: { pos: [number, number, number]; scale: [number, number, number]; color: string }[] =
      [];
    for (const b of buildings) {
      const [w, h, d] = b.size;
      for (let i = 0; i < b.bands; i++) {
        const y = -h / 2 + (h / (b.bands + 1)) * (i + 1);
        out.push({
          pos: [b.position[0], b.position[1] + y, b.position[2] + d / 2 + 0.03],
          scale: [w * 0.72, 0.34, 1],
          color: b.color,
        });
        out.push({
          pos: [b.position[0] - w / 2 - 0.03, b.position[1] + y, b.position[2]],
          scale: [d * 0.72, 0.34, 1],
          color: b.color,
        });
      }
    }
    return out;
  }, []);

  const masts = useMemo(() => buildings.filter((b) => b.spire > 0), []);

  return (
    <group>
      {/* Hulls. Far more metallic than the city's concrete towers, so the key
          light rakes across them and the modules read as machined hardware. */}
      <Instances limit={buildings.length} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry />
        <meshStandardMaterial color="#2b3342" roughness={0.34} metalness={0.9} />
        {buildings.map((b) => (
          <Instance key={b.id} position={b.position} scale={b.size} />
        ))}
      </Instances>

      {/* Structural collar around the base of each module: a darker inset ring
          that stops a plain box from reading as a plain box. */}
      {detail && (
        <Instances limit={buildings.length} castShadow={shadows}>
          <boxGeometry />
          <meshStandardMaterial color="#161c27" roughness={0.5} metalness={0.75} />
          {buildings.map((b) => (
            <Instance
              key={b.id}
              position={[b.position[0], b.position[1] - b.size[1] / 2 + 1.1, b.position[2]]}
              scale={[b.size[0] + 0.5, 2.2, b.size[2] + 0.5]}
            />
          ))}
        </Instances>
      )}

      {/* Docking collar / running lights along the top edge. */}
      <Instances limit={buildings.length}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
        {buildings.map((b) => (
          <Instance
            key={b.id}
            position={[b.position[0], b.position[1] + b.size[1] / 2 + 0.1, b.position[2]]}
            scale={[b.size[0] + 0.22, 0.16, b.size[2] + 0.22]}
            color={b.color}
          />
        ))}
      </Instances>

      {/* Viewport strips */}
      {detail && (
        <Instances limit={Math.max(1, viewports.length)}>
          <planeGeometry />
          <meshBasicMaterial toneMapped={false} transparent opacity={0.7} side={THREE.DoubleSide} />
          {viewports.map((v, i) => (
            <Instance
              key={i}
              position={v.pos}
              scale={v.scale}
              rotation={[0, i % 2 === 0 ? 0 : Math.PI / 2, 0]}
              color={v.color}
            />
          ))}
        </Instances>
      )}

      {/* Comms masts, where the city had rooftop antennae. */}
      {detail && (
        <Instances limit={Math.max(1, masts.length)}>
          <cylinderGeometry args={[0.05, 0.1, 1, 6]} />
          <meshBasicMaterial toneMapped={false} />
          {masts.map((b) => (
            <Instance
              key={b.id}
              position={[b.position[0], b.position[1] + b.size[1] / 2 + b.spire / 2, b.position[2]]}
              scale={[1, b.spire, 1]}
              color={b.color}
            />
          ))}
        </Instances>
      )}

      {/* Hazard beacon on top of the taller modules. */}
      {detail && (
        <Instances limit={Math.max(1, masts.length)}>
          <sphereGeometry args={[0.24, 8, 6]} />
          <meshBasicMaterial toneMapped={false} color="#ff5470" />
          {masts.map((b) => (
            <Instance
              key={b.id}
              position={[b.position[0], b.position[1] + b.size[1] / 2 + b.spire + 0.2, b.position[2]]}
            />
          ))}
        </Instances>
      )}
    </group>
  );
};

/* ===========================================================================
 * DECK CLUTTER
 * The city's lamp posts, crates and signs, re-cast as hangar equipment.
 * ========================================================================= */

const DeckProps: React.FC<{ accent: string }> = ({ accent }) => {
  const bollards = useMemo(() => PROPS.filter((p) => p.kind === 'lamp'), []);
  const crates = useMemo(() => PROPS.filter((p) => p.kind === 'crate'), []);
  const consoles = useMemo(() => PROPS.filter((p) => p.kind === 'sign'), []);

  return (
    <group>
      {/* Light bollards lining the landing lane. Shorter and squarer than the
          city's lamp posts - nothing tall and spindly survives on a deck. */}
      <Instances limit={Math.max(1, bollards.length)}>
        <boxGeometry />
        <meshStandardMaterial color="#252d3b" roughness={0.4} metalness={0.85} />
        {bollards.map((p, i) => (
          <Instance key={i} position={[p.x, 1.1, p.z]} scale={[0.42, 2.2, 0.42]} />
        ))}
      </Instances>

      <Instances limit={Math.max(1, bollards.length)}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} color={accent} />
        {bollards.map((p, i) => (
          <Instance key={i} position={[p.x, 2.28, p.z]} scale={[0.5, 0.14, 0.5]} />
        ))}
      </Instances>

      {/* Cargo containers */}
      <Instances limit={Math.max(1, crates.length)}>
        <boxGeometry />
        <meshStandardMaterial color="#1c2431" roughness={0.42} metalness={0.8} />
        {crates.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 0.62, p.z]}
            rotation={[0, p.rot, 0]}
            scale={[1.5, 1.24, 1.1]}
          />
        ))}
      </Instances>

      {/* Identification stripe on each container */}
      <Instances limit={Math.max(1, crates.length)}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} color={accent} />
        {crates.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 1.02, p.z]}
            rotation={[0, p.rot, 0]}
            scale={[1.56, 0.1, 1.16]}
          />
        ))}
      </Instances>

      {/* Freestanding consoles, where the city had signage */}
      <Instances limit={Math.max(1, consoles.length)}>
        <boxGeometry />
        <meshStandardMaterial color="#202836" roughness={0.4} metalness={0.85} />
        {consoles.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 0.7, p.z]}
            rotation={[0, p.rot, 0]}
            scale={[1.3, 1.4, 0.5]}
          />
        ))}
      </Instances>

      {/* ...and the screen on the front of it, tilted towards the reader */}
      <Instances limit={Math.max(1, consoles.length)}>
        <planeGeometry />
        <meshBasicMaterial toneMapped={false} color={accent} transparent opacity={0.75} side={THREE.DoubleSide} />
        {consoles.map((p, i) => (
          <Instance
            key={i}
            position={[p.x + Math.sin(p.rot) * 0.27, 1.16, p.z + Math.cos(p.rot) * 0.27]}
            rotation={[-0.45, p.rot, 0]}
            scale={[1.0, 0.72, 1]}
          />
        ))}
      </Instances>
    </group>
  );
};

/* ===========================================================================
 * MOTES
 * Dust hanging in the air, drifting up through the deck lights. The city's
 * rain shader with the fall reversed and the streak rounded off.
 * ========================================================================= */

const moteVertex = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  attribute float aSpeed;
  attribute float aOffset;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float rise = mod(aOffset + uTime * aSpeed, uHeight);
    p.y = rise;
    // A lazy sway, so nothing travels in a dead straight line.
    p.x += sin(uTime * 0.28 + aOffset) * 1.3;
    p.z += cos(uTime * 0.21 + aOffset * 1.7) * 1.3;

    float t = rise / uHeight;
    vAlpha = smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.55, 1.0, t));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (60.0 / -mv.z) * (0.7 + aSpeed * 0.35);
    gl_Position = projectionMatrix * mv;
  }
`;

const moteFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.0, 0.5, d)) * vAlpha * 0.6;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

const Motes: React.FC<{ count: number; color: string }> = ({ count, color }) => {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 190;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 190 + 26;
      speeds[i] = 0.5 + Math.random() * 1.5;
      offsets[i] = Math.random() * 34;
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
      uHeight: { value: 34 },
      uColor: { value: new THREE.Color(color) },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  uniforms.uColor.value.set(color);

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={moteVertex}
        fragmentShader={moteFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

/* ===========================================================================
 * CONTAINMENT FIELD
 * The hull's edge. Where the city had a soft glowing wall, the station has a
 * visible field holding the atmosphere in.
 * ========================================================================= */

const fieldVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fieldFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uAspect;
  varying vec2 vUv;

  void main() {
    // Grid of cells across the field.
    vec2 g = vec2(vUv.x * uAspect * 6.0, vUv.y * 6.0);
    vec2 cell = abs(fract(g) - 0.5);
    float line = 1.0 - smoothstep(0.42, 0.5, max(cell.x, cell.y));

    // Stronger at the deck, fading out towards the top.
    float rise = 1.0 - smoothstep(0.0, 1.0, vUv.y);

    // A charge travelling up the field.
    float scan = smoothstep(0.86, 1.0, sin(vUv.y * 9.0 - uTime * 1.4) * 0.5 + 0.5);

    float a = (0.05 + line * 0.11 + scan * 0.16) * rise;
    gl_FragColor = vec4(uColor, a);
  }
`;

const ContainmentField: React.FC<{ color: string }> = ({ color }) => {
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const HEIGHT = 9;

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
              uColor: { value: new THREE.Color(color) },
              uTime: { value: 0 },
              uAspect: { value: wall.size[0] / wall.size[1] },
            }}
            vertexShader={fieldVertex}
            fragmentShader={fieldFragment}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
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

export const SpaceStation: React.FC<Props> = ({ profile, primary, accent, glow }) => (
  <group>
    <Space glow={glow} accent={accent} />
    <Deck primary={primary} accent={accent} />
    <Modules detail={profile.detail} shadows={profile.shadows} />
    {profile.detail && <DeckProps accent={accent} />}
    {profile.particles > 0 && <Motes count={Math.round(profile.particles * 0.5)} color={primary} />}
    <ContainmentField color={primary} />
  </group>
);
