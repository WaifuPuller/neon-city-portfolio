import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore, selectCoreCount } from '../../store/useGameStore';
import { Zone } from '../../types/game';

/* ---------------------------------------------------------------------------
 * Landmarks are the interactive "portals". Each one is a light beam, a ground
 * ring, an orbiting frame and a floating label. Everything is procedural
 * geometry, so there are no models to download.
 * ------------------------------------------------------------------------- */

const beamVertex = /* glsl */ `
  varying float vY;
  void main() {
    vY = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying float vY;

  void main() {
    // Fade out towards the top, plus a travelling scan band.
    float fade = pow(1.0 - vY, 1.7);
    float scan = smoothstep(0.72, 1.0, sin(vY * 14.0 - uTime * 2.6) * 0.5 + 0.5);
    float a = (fade * 0.30 + scan * fade * 0.55) * uIntensity;
    gl_FragColor = vec4(uColor, a);
  }
`;

/** Scratch vector so the per-frame label test allocates nothing. */
const _labelPos = new THREE.Vector3();

const Beam: React.FC<{ color: string; active: boolean }> = ({ color, active }) => {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uIntensity: { value: 1 },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  uniforms.uColor.value.set(color);

  useFrame((state, delta) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    mat.current.uniforms.uIntensity.value = THREE.MathUtils.damp(
      mat.current.uniforms.uIntensity.value,
      active ? 1.9 : 1,
      6,
      delta,
    );
  });

  return (
    <mesh position={[0, 9, 0]}>
      <cylinderGeometry args={[1.5, 2.1, 18, 24, 1, true]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={beamVertex}
        fragmentShader={beamFragment}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

const LandmarkNode: React.FC<{ zone: Zone; active: boolean; locked: boolean }> = ({
  zone,
  active,
  locked,
}) => {
  const ring = useRef<THREE.Mesh>(null);
  const frame = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const label = useRef<HTMLDivElement>(null);
  const lastScale = useRef(1);
  const lastOpacity = useRef(1);

  const color = locked ? '#64748b' : zone.color;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    /* ------------------------------------------------------------- label ---
     * drei's distanceFactor scales the label as 1/distance, which is right at
     * a distance but turns into a screen-filling wall of text once you walk
     * into the ring. Counter-scale below CLAMP_AT so the on-screen size stops
     * growing, then fade out entirely up close — at that range the HUD prompt
     * is already naming the landmark, so the 3D label is pure clutter.
     */
    if (label.current) {
      const dist = state.camera.position.distanceTo(
        _labelPos.set(zone.position[0], zone.position[1] + 5.1, zone.position[2]),
      );
      const CLAMP_AT = 16;
      const scale = dist < CLAMP_AT ? Math.max(0.32, dist / CLAMP_AT) : 1;
      const opacity = dist < 7 || dist > 110 ? 0 : 1;

      // Writing to style every frame forces a style recalculation per label,
      // and there are nine of them. Only touch the DOM when a value actually
      // changes.
      if (Math.abs(scale - lastScale.current) > 0.01) {
        lastScale.current = scale;
        label.current.style.transform = `scale(${scale.toFixed(3)})`;
      }
      if (opacity !== lastOpacity.current) {
        lastOpacity.current = opacity;
        label.current.style.opacity = String(opacity);
      }
    }
    if (ring.current) ring.current.rotation.z += delta * 0.35;
    if (frame.current) {
      frame.current.rotation.y += delta * (active ? 1.5 : 0.55);
      frame.current.position.y = 2.4 + Math.sin(t * 1.4) * 0.18;
    }
    if (core.current) {
      core.current.rotation.y -= delta * 1.1;
      core.current.rotation.x += delta * 0.5;
      const s = active ? 1.25 + Math.sin(t * 6) * 0.06 : 1;
      core.current.scale.setScalar(THREE.MathUtils.damp(core.current.scale.x, s, 8, delta));
    }
    if (glow.current) {
      const target = active ? 0.5 : 0.22;
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = THREE.MathUtils.damp(m.opacity, target, 6, delta);
    }
  });

  return (
    <group position={zone.position}>
      {!locked && <Beam color={color} active={active} />}

      {/* Ground disc */}
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[zone.radius * 0.92, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* Rotating rim */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[zone.radius * 0.86, zone.radius, 48]} />
        <meshBasicMaterial
          color={color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>

      {/* Orbiting frame + core */}
      <group ref={frame} position={[0, 2.4, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.25, 0.05, 10, 40]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 3]}>
          <torusGeometry args={[1.05, 0.035, 10, 40]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
        </mesh>
        <mesh ref={core}>
          <icosahedronGeometry args={[0.55, 0]} />
          <meshBasicMaterial color={color} wireframe toneMapped={false} />
        </mesh>
        {/* Only the landmark you are standing at gets a real light. Nine
            permanent point lights cost far more than they showed: every lit
            material evaluates every light per fragment, and the emissive
            materials plus bloom already carry the glow. */}
        {active && <pointLight color={color} intensity={14} distance={18} decay={2} />}
      </group>

      {/* Floating label */}
      <Html
        position={[0, 5.1, 0]}
        center
        distanceFactor={13}
        zIndexRange={[8, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          ref={label}
          className={`whitespace-nowrap rounded-xl border px-3 py-2 text-center font-orbitron backdrop-blur-sm ${
            active
              ? 'border-white/70 bg-black/80 shadow-[0_0_28px_rgba(255,255,255,0.28)]'
              : 'border-white/15 bg-black/55'
          }`}
          style={{
            color: locked ? '#94a3b8' : color,
            transition: 'opacity 220ms ease, border-color 200ms ease',
            willChange: 'transform, opacity',
          }}
        >
          <div className="text-[13px] font-black tracking-[0.14em]">
            {locked ? 'SEALED' : zone.name}
          </div>
          <div className="mt-0.5 text-[9px] font-semibold tracking-[0.22em] text-white/55">
            {locked ? 'REQUIRES 5 DATA CORES' : zone.subtitle.toUpperCase()}
          </div>
        </div>
      </Html>
    </group>
  );
};

/* ------------------------------------------------------------- collectibles */

const Core: React.FC<{ position: [number, number, number]; index: number }> = ({
  position,
  index,
}) => {
  const shell = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime + index * 1.7;
    const bob = Math.sin(t * 1.9) * 0.28;
    if (shell.current) {
      shell.current.rotation.y += delta * 1.5;
      shell.current.rotation.x += delta * 0.7;
      shell.current.position.y = bob;
    }
    if (inner.current) {
      inner.current.position.y = bob;
      inner.current.scale.setScalar(1 + Math.sin(t * 5) * 0.13);
    }
    if (halo.current) halo.current.rotation.z += delta * 0.8;
  });

  return (
    <group position={position}>
      <mesh ref={shell}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial color="#fbbf24" wireframe toneMapped={false} />
      </mesh>
      <mesh ref={inner}>
        <octahedronGeometry args={[0.24, 0]} />
        <meshBasicMaterial color="#fef08a" toneMapped={false} />
      </mesh>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]}>
        <ringGeometry args={[0.7, 0.95, 28]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      {/* No point light here on purpose - the emissive core plus bloom reads
          as a glow for none of the per-fragment cost. */}
    </group>
  );
};

/* ========================================================================= */

export const Landmarks: React.FC = () => {
  const zones = useGameStore((s) => s.zones);
  const nearby = useGameStore((s) => s.nearbyZone);
  const collectibles = useGameStore((s) => s.collectibles);
  const cores = useGameStore(selectCoreCount);

  return (
    <group>
      {zones.map((zone) => (
        <LandmarkNode
          key={zone.id}
          zone={zone}
          active={nearby?.id === zone.id}
          locked={!!zone.locked && cores < 5}
        />
      ))}

      {collectibles.map(
        (c, i) => !c.collected && <Core key={c.id} position={c.position} index={i} />,
      )}
    </group>
  );
};
