import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { NeonCity } from './NeonCity';
import { SpaceStation } from './SpaceStation';
import { AncientRuins } from './AncientRuins';
import { BuildingScreens } from './BuildingScreens';
import { Orbiter } from './Orbiter';
import { Landmarks } from './Landmarks';
import { Player } from './Player';
import { NavPath } from './NavPath';
import { CinematicIntro } from './CinematicIntro';
import { PreviewOrbit } from './PreviewOrbit';
import { AdaptiveQuality } from './AdaptiveQuality';
import { useGameStore, THEMES } from '../../store/useGameStore';
import { QUALITY_PROFILES, type QualityProfile } from '../../utils/device';
import { portfolio } from '../../config/portfolio';
import { getWorld, type WorldDefinition, type WorldId } from '../../config/worlds';
import { projectAccent } from '../../utils/accent';

/* ---------------------------------------------------------------------------
 * Floating project holograms above the AI Lab. These give the lab a reason to
 * exist visually before the visitor opens the modal.
 * ------------------------------------------------------------------------- */

const HologramPanel: React.FC<{
  title: string;
  category: string;
  color: string;
  angle: number;
  radius: number;
}> = ({ title, category, color, angle, radius }) => {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime * 0.22 + angle;
    group.current.position.set(Math.cos(t) * radius, 5.6 + Math.sin(t * 2) * 0.4, Math.sin(t) * radius);
    // Always face outwards from the centre of the ring.
    group.current.rotation.y = -t + Math.PI / 2;
  });

  return (
    <group ref={group}>
      <mesh>
        <planeGeometry args={[3.1, 1.7]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.13}
          side={THREE.DoubleSide}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[1.5, 1.56, 4]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <Html center distanceFactor={11} style={{ pointerEvents: 'none' }} zIndexRange={[6, 0]}>
        <div className="w-44 text-center font-orbitron" style={{ color }}>
          <div className="text-[8px] font-bold tracking-[0.3em] opacity-70">
            {category.toUpperCase()}
          </div>
          <div className="mt-1 text-[13px] font-black leading-tight drop-shadow-[0_0_10px_currentColor]">
            {title}
          </div>
        </div>
      </Html>
    </group>
  );
};

const LabHolograms: React.FC = () => {
  const labZone = useGameStore((s) => s.zones.find((z) => z.modal === 'projects'));

  const list = useMemo(() => {
    const featured = portfolio.projects.filter((p) => p.featured);
    // Show the featured ones, or just the first few if none are flagged.
    return (featured.length > 0 ? featured : portfolio.projects).slice(0, 3);
  }, []);

  // No projects, or no lab to orbit: render nothing rather than an empty ring.
  if (!labZone || list.length === 0) return null;

  return (
    <group position={labZone.position}>
      {list.map((p, i) => (
        <HologramPanel
          key={p.id}
          title={p.title}
          category={p.category}
          color={projectAccent(p, i)}
          // A single project sits front and centre instead of orbiting.
          angle={list.length === 1 ? Math.PI : (i / list.length) * Math.PI * 2}
          radius={list.length === 1 ? 5 : 6.4}
        />
      ))}
    </group>
  );
};

/* ------------------------------------------------------------------ lighting */

const Lighting: React.FC<{
  shadows: boolean;
  primary: string;
  accent: string;
  world: WorldDefinition;
}> = ({ shadows, primary, accent, world }) => {
  const key = useRef<THREE.DirectionalLight>(null);

  /* Every number here comes from the world registry rather than a chain of
     "is it the station?" checks. Each setting needs its key light aimed at
     whatever sun its own sky shader draws, or the shadows fall the wrong way,
     and needs its own fill: vacuum bounces almost nothing, a desert at golden
     hour bounces a great deal. */
  const { light } = world;

  return (
    <>
      <ambientLight intensity={light.ambientIntensity} color={light.ambientColor} />
      <hemisphereLight args={[light.hemisphere[0], light.hemisphere[1], light.hemisphere[2]]} />
      {/* The key light stays close to neutral. Tinting it with the theme
          colour looked good on the grey buildings but wrecked the character's
          skin and clothing — a cyan key over an orange model reads as green. */}
      <directionalLight
        ref={key}
        position={light.keyPosition}
        intensity={light.keyIntensity}
        color={light.keyColor}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-bias={-0.0012}
      />
      {/* Coloured rim and bounce carry the neon mood without poisoning the
          diffuse colour of anything standing in the street. */}
      <directionalLight position={[-30, 24, 90]} intensity={0.7} color={accent} />
      <directionalLight position={[26, 14, -40]} intensity={0.5} color={primary} />
      <pointLight position={[0, 12, 34]} intensity={40} distance={55} decay={2} color={primary} />
      <pointLight position={[0, 10, 72]} intensity={30} distance={45} decay={2} color={accent} />
    </>
  );
};

/* ---------------------------------------------------------------------------
 * The only place that knows which component draws which world.
 *
 * All three take exactly the same props and read the same data out of
 * world.ts, so they are interchangeable - which is what lets the visitor swap
 * between them mid-session without anything else in the game noticing.
 * ------------------------------------------------------------------------- */

interface EnvironmentProps {
  profile: QualityProfile;
  primary: string;
  accent: string;
  glow: string;
}

const ENVIRONMENTS: Record<WorldId, React.FC<EnvironmentProps>> = {
  'neon-city': NeonCity,
  'space-station': SpaceStation,
  'ancient-ruins': AncientRuins,
};

/* ========================================================================= */

export const Scene: React.FC<{ onCaption: (c: string | null) => void }> = ({ onCaption }) => {
  const quality = useGameStore((s) => s.quality);
  const theme = useGameStore((s) => s.theme);
  const worldId = useGameStore((s) => s.worldId);

  const leanMode = useGameStore((s) => s.leanMode);

  /* One derived profile, so nothing downstream has to know lean mode exists -
     the worlds already gate their decoration on `detail` and `particles`. */
  const base = QUALITY_PROFILES[quality];
  const profile = useMemo(
    () => (leanMode ? { ...base, detail: false, particles: 0 } : base),
    [base, leanMode],
  );

  const palette = THEMES[theme];
  const world = getWorld(worldId);
  const Environment = ENVIRONMENTS[world.id];

  return (
    <>
      <fog attach="fog" args={[world.fog.color, world.fog.near, profile.fogFar * world.fog.farScale]} />
      <color attach="background" args={[world.fog.color]} />

      <Lighting
        shadows={profile.shadows}
        primary={palette.primary}
        accent={palette.accent}
        world={world}
      />

      <Environment
        profile={profile}
        primary={palette.primary}
        accent={palette.accent}
        glow={palette.secondary}
      />
      <LabHolograms />
      {/* The owner's own pictures: panels on the towers, and a banner on the
          craft circling outside the map. Both render nothing at all until
          images are dropped into src/assets/images/. */}
      <BuildingScreens accent={palette.accent} />
      <Orbiter primary={palette.primary} accent={palette.accent} />
      <Landmarks />
      <NavPath />
      <Player />
      <CinematicIntro onCaption={onCaption} />
      <PreviewOrbit />
      <AdaptiveQuality />

      {/* 4x MSAA on the composer target is a large cost for very little gain
          once bloom has softened the image; 2x is plenty. */}
      {profile.bloom && (
        <EffectComposer multisampling={profile.antialias ? 2 : 0}>
          <Bloom
            intensity={1.15}
            luminanceThreshold={0.22}
            luminanceSmoothing={0.35}
            mipmapBlur
            radius={0.72}
          />
          <Vignette eskil={false} offset={0.22} darkness={0.82} />
        </EffectComposer>
      )}
    </>
  );
};

export default Scene;
