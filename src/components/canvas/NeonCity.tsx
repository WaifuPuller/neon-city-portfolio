import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { buildings, PROPS, WORLD_BOUNDS } from '../../systems/world';
import { QualityProfile } from '../../utils/device';

/* ===========================================================================
 * GROUND
 * A single plane with a procedural grid in the fragment shader. Cheaper than
 * a texture, stays crisp at any zoom, and fades out with distance so the fog
 * has something to eat into.
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
  uniform vec3 uGridColor;
  uniform vec3 uRoadColor;
  uniform vec3 uBaseColor;
  uniform float uTime;
  varying vec2 vWorld;

  // NOTE: smoothstep() with edge0 > edge1 is undefined in GLSL, so every
  // descending ramp here is written as 1.0 - smoothstep(lo, hi, x).
  float gridLine(vec2 p, float spacing, float thickness) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
    vec2 fw = fwidth(p) + 1e-4;
    vec2 line = 1.0 - smoothstep(thickness - fw, thickness + fw, g);
    return max(line.x, line.y);
  }

  void main() {
    float fine = gridLine(vWorld, 4.0, 0.035);
    float coarse = gridLine(vWorld, 20.0, 0.09);

    // The central boulevard glows brighter than the side streets.
    float boulevard = 1.0 - smoothstep(6.0, 8.5, abs(vWorld.x));

    // A pulse of light travelling north along the road.
    float pulse = smoothstep(0.86, 1.0, sin(vWorld.y * 0.09 - uTime * 0.9) * 0.5 + 0.5);

    float dist = length(vWorld);
    float falloff = 1.0 - smoothstep(40.0, 155.0, dist);

    vec3 color = uBaseColor;
    color += uGridColor * fine * 0.26 * falloff;
    color += uGridColor * coarse * 0.48 * falloff;
    // Keep the road base dim so the character stays readable against it; the
    // travelling pulse carries most of the colour.
    color += uRoadColor * boulevard * 0.035 * falloff;
    color += uRoadColor * boulevard * pulse * 0.50 * falloff;

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const Ground: React.FC<{ primary: string; accent: string }> = ({ primary, accent }) => {
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uGridColor: { value: new THREE.Color(primary) },
      uRoadColor: { value: new THREE.Color(accent) },
      uBaseColor: { value: new THREE.Color('#05060e') },
      uTime: { value: 0 },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Recolour in place rather than rebuilding the material on theme change.
  uniforms.uGridColor.value.set(primary);
  uniforms.uRoadColor.value.set(accent);

  useFrame((state) => {
    if (material.current) {
      material.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
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
 * RAIN
 * Vertical streaks animated entirely on the GPU: the vertex shader wraps each
 * particle's Y with a modulo of time, so the CPU never touches the buffer.
 * ========================================================================= */

const rainVertex = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  attribute float aSpeed;
  attribute float aOffset;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float fall = mod(aOffset + uTime * aSpeed, uHeight);
    p.y = uHeight - fall;
    float t = fall / uHeight;
    // Fade in as the drop enters, fade out before it reaches the street.
    vAlpha = smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(0.75, 1.0, t));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (140.0 / -mv.z) * (0.6 + aSpeed * 0.02);
    gl_Position = projectionMatrix * mv;
  }
`;

const rainFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    // Stretch the point into a vertical streak.
    float d = length(vec2(c.x * 5.0, c.y));
    float a = smoothstep(0.5, 0.0, d) * vAlpha * 0.55;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

const Rain: React.FC<{ count: number; color: string }> = ({ count, color }) => {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 190;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 190 + 26;
      speeds[i] = 14 + Math.random() * 22;
      offsets[i] = Math.random() * 70;
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
      uHeight: { value: 70 },
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
        vertexShader={rainVertex}
        fragmentShader={rainFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

/* ===========================================================================
 * BUILDINGS
 * Four instanced meshes total (body, roof trim, window band, spire) instead of
 * roughly 280 individual draw calls.
 * ========================================================================= */

const Buildings: React.FC<{ detail: boolean; shadows: boolean }> = ({ detail, shadows }) => {
  const bands = useMemo(() => {
    const out: { pos: [number, number, number]; scale: [number, number, number]; color: string }[] =
      [];
    for (const b of buildings) {
      const [w, h, d] = b.size;
      for (let i = 0; i < b.bands; i++) {
        const y = -h / 2 + (h / (b.bands + 1)) * (i + 1);
        out.push({
          pos: [b.position[0], b.position[1] + y, b.position[2] + d / 2 + 0.03],
          scale: [w * 0.78, 0.5, 1],
          color: b.color,
        });
        out.push({
          pos: [b.position[0] - w / 2 - 0.03, b.position[1] + y, b.position[2]],
          scale: [d * 0.78, 0.5, 1],
          color: b.color,
        });
      }
    }
    return out;
  }, []);

  const spires = useMemo(() => buildings.filter((b) => b.spire > 0), []);

  return (
    <group>
      {/* Tower bodies */}
      <Instances limit={buildings.length} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry />
        {/* Enough diffuse to catch the key light — pure black towers read as
            holes in the sky rather than architecture. */}
        <meshStandardMaterial color="#1a2540" roughness={0.5} metalness={0.45} />
        {buildings.map((b) => (
          <Instance key={b.id} position={b.position} scale={b.size} />
        ))}
      </Instances>

      {/* Roof neon trim */}
      <Instances limit={buildings.length}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
        {buildings.map((b) => (
          <Instance
            key={b.id}
            position={[b.position[0], b.position[1] + b.size[1] / 2 + 0.12, b.position[2]]}
            scale={[b.size[0] + 0.28, 0.22, b.size[2] + 0.28]}
            color={b.color}
          />
        ))}
      </Instances>

      {/* Window light bands */}
      {detail && (
        <Instances limit={bands.length}>
          <planeGeometry />
          <meshBasicMaterial
            toneMapped={false}
            transparent
            opacity={0.62}
            side={THREE.DoubleSide}
          />
          {bands.map((band, i) => (
            <Instance
              key={i}
              position={band.pos}
              scale={band.scale}
              rotation={[0, i % 2 === 0 ? 0 : Math.PI / 2, 0]}
              color={band.color}
            />
          ))}
        </Instances>
      )}

      {/* Rooftop antennae */}
      {detail && (
        <Instances limit={Math.max(1, spires.length)}>
          <cylinderGeometry args={[0.06, 0.14, 1, 6]} />
          <meshBasicMaterial toneMapped={false} />
          {spires.map((b) => (
            <Instance
              key={b.id}
              position={[b.position[0], b.position[1] + b.size[1] / 2 + b.spire / 2, b.position[2]]}
              scale={[1, b.spire, 1]}
              color={b.color}
            />
          ))}
        </Instances>
      )}
    </group>
  );
};

/* ===========================================================================
 * STREET PROPS
 * ========================================================================= */

const StreetProps: React.FC<{ accent: string }> = ({ accent }) => {
  const lamps = useMemo(() => PROPS.filter((p) => p.kind === 'lamp'), []);
  const crates = useMemo(() => PROPS.filter((p) => p.kind !== 'lamp'), []);

  return (
    <group>
      {/* Lamp posts */}
      <Instances limit={Math.max(1, lamps.length)}>
        <cylinderGeometry args={[0.09, 0.12, 1, 6]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.5} />
        {lamps.map((p, i) => (
          <Instance key={i} position={[p.x, 2.4, p.z]} scale={[1, 4.8, 1]} />
        ))}
      </Instances>

      {/* Lamp heads — emissive so bloom picks them up */}
      <Instances limit={Math.max(1, lamps.length)}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} color={accent} />
        {lamps.map((p, i) => (
          <Instance key={i} position={[p.x, 4.85, p.z]} scale={[0.5, 0.12, 0.5]} />
        ))}
      </Instances>

      {/* Crates and signage */}
      <Instances limit={Math.max(1, crates.length)}>
        <boxGeometry />
        <meshStandardMaterial color="#111a2e" roughness={0.5} metalness={0.4} />
        {crates.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, p.kind === 'crate' ? 0.5 : 1.6, p.z]}
            rotation={[0, p.rot, 0]}
            scale={p.kind === 'crate' ? [1.1, 1, 1.1] : [1.5, 3.2, 0.14]}
          />
        ))}
      </Instances>
    </group>
  );
};

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

  void main() {
    float h = normalize(vPos).y;
    vec3 col = mix(uHorizon, uTop, smoothstep(-0.05, 0.62, h));
    // City glow bleeding up from the horizon.
    col += uGlow * pow(max(0.0, 1.0 - abs(h) * 2.6), 3.0) * 0.55;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const Sky: React.FC<{ glow: string }> = ({ glow }) => {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#03030a') },
      uHorizon: { value: new THREE.Color('#160b26') },
      uGlow: { value: new THREE.Color(glow) },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  uniforms.uGlow.value.set(glow);

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
 * BOUNDARY
 * A glowing containment wall so the edge of the map reads as intentional.
 * ========================================================================= */

const Boundary: React.FC<{ color: string }> = ({ color }) => {
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const w = maxX - minX;
  const d = maxZ - minZ;

  const walls: { pos: [number, number, number]; size: [number, number] }[] = [
    { pos: [cx, 4, minZ], size: [w, 8] },
    { pos: [cx, 4, maxZ], size: [w, 8] },
    { pos: [minX, 4, cz], size: [d, 8] },
    { pos: [maxX, 4, cz], size: [d, 8] },
  ];

  return (
    <group>
      {walls.map((wall, i) => (
        <mesh
          key={i}
          position={wall.pos}
          rotation={[0, i < 2 ? 0 : Math.PI / 2, 0]}
        >
          <planeGeometry args={wall.size} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.07}
            side={THREE.DoubleSide}
            toneMapped={false}
            depthWrite={false}
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

export const NeonCity: React.FC<Props> = ({ profile, primary, accent, glow }) => (
  <group>
    <Sky glow={glow} />
    <Ground primary={primary} accent={accent} />
    <Buildings detail={profile.detail} shadows={profile.shadows} />
    {profile.detail && <StreetProps accent={accent} />}
    {profile.particles > 0 && <Rain count={profile.particles} color={primary} />}
    <Boundary color={primary} />
  </group>
);
