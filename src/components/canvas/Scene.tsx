import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { NeonCity } from './NeonCity';
import { SpaceStation } from './SpaceStation';
import { Landmarks } from './Landmarks';
import { Player } from './Player';
import { NavPath } from './NavPath';
import { CinematicIntro } from './CinematicIntro';
import { AdaptiveQuality } from './AdaptiveQuality';
import { useGameStore, THEMES } from '../../store/useGameStore';
import { QUALITY_PROFILES } from '../../utils/device';
import { portfolio, worldSetting } from '../../config/portfolio';
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

const Lighting: React.FC<{ shadows: boolean; primary: string; accent: string }> = ({
  shadows,
  primary,
  accent,
}) => {
  const key = useRef<THREE.DirectionalLight>(null);

  /* In orbit the key light is the sun drawn in the sky shader, so it has to
     come from the same direction or the shadows point the wrong way. Vacuum
     also means almost no bounce, hence the much weaker fill - the coloured rim
     lights below do the work the city's smog used to do. */
  const station = worldSetting === 'space-station';
  const keyPos: [number, number, number] = station ? [82, 30, -99] : [38, 60, -20];

  return (
    <>
      <ambientLight intensity={station ? 0.26 : 0.45} color={station ? '#1b2438' : '#243352'} />
      <hemisphereLight args={[station ? '#16224a' : '#1b2a5a', '#05060e', station ? 0.45 : 0.7]} />
      {/* The key light stays close to neutral. Tinting it with the theme
          colour looked good on the grey buildings but wrecked the character's
          skin and clothing — a cyan key over an orange model reads as green. */}
      <directionalLight
        ref={key}
        position={keyPos}
        intensity={station ? 2.1 : 1.5}
        color={station ? '#fff2df' : '#e8f0ff'}
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

/* ========================================================================= */

export const Scene: React.FC<{ onCaption: (c: string | null) => void }> = ({ onCaption }) => {
  const quality = useGameStore((s) => s.quality);
  const theme = useGameStore((s) => s.theme);
  const profile = QUALITY_PROFILES[quality];
  const palette = THEMES[theme];

  return (
    <>
      {/* Vacuum is clear, so the station keeps only enough haze to hide the far
          edge of the deck; the city keeps its heavy rain-soaked murk. */}
      {worldSetting === 'space-station' ? (
        <fog attach="fog" args={['#070910', 46, profile.fogFar * 1.35]} />
      ) : (
        <fog attach="fog" args={['#06070f', 26, profile.fogFar]} />
      )}
      <color attach="background" args={['#05060e']} />

      <Lighting shadows={profile.shadows} primary={palette.primary} accent={palette.accent} />

      {worldSetting === 'space-station' ? (
        <SpaceStation
          profile={profile}
          primary={palette.primary}
          accent={palette.accent}
          glow={palette.secondary}
        />
      ) : (
        <NeonCity
          profile={profile}
          primary={palette.primary}
          accent={palette.accent}
          glow={palette.secondary}
        />
      )}
      <LabHolograms />
      <Landmarks />
      <NavPath />
      <Player />
      <CinematicIntro onCaption={onCaption} />
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
