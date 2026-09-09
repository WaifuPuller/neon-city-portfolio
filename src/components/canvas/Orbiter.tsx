import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { media, orbiterImageUrl } from '../../config/media';
import { getWorld } from '../../config/worlds';
import { useGameStore } from '../../store/useGameStore';
import { useOptionalTextures } from '../../hooks/useOptionalTextures';
import { BANNER_ANCHORS, FLIGHT, ORBITER_FORMS } from './OrbiterForms';

/* ---------------------------------------------------------------------------
 * The craft circling the outside of the map, carrying the owner's banner.
 *
 * It flies well beyond WORLD_BOUNDS, so it is always scenery and never
 * something the player can reach or collide with - which is why it needs no
 * entry in world.ts and does not affect routing or the maps.
 *
 * Its shape follows the setting: a freighter over the neon city, a supply
 * plane over the drop zone, a sky lantern over the district, a drifting slab
 * of masonry over the ruins. media.ts can pin one shape for every world if the
 * owner would rather.
 *
 * Every material opts out of fog. Fog exists to hide the far edge of the
 * ground plane, and at this distance it would swallow the craft whole on the
 * lower quality settings - where fogFar is 118.
 * ------------------------------------------------------------------------- */

export const Orbiter: React.FC<{ primary: string; accent: string }> = ({ primary, accent }) => {
  const cfg = media.orbiter;
  const worldId = useGameStore((s) => s.worldId);
  const world = getWorld(worldId);

  /* 'auto' - the default - takes both shape and colour from the world. Setting
     either in media.ts pins it everywhere instead. */
  const kind = cfg.kind === 'auto' ? world.orbiter.kind : cfg.kind;
  const hullColor = cfg.color ? cfg.color : world.orbiter.color;

  const Form = ORBITER_FORMS[kind];
  const anchor = BANNER_ANCHORS[kind];
  const flight = FLIGHT[kind];

  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);

  const textures = useOptionalTextures(orbiterImageUrl ? [orbiterImageUrl] : []);
  const banner = orbiterImageUrl ? textures[orbiterImageUrl] : undefined;

  /* The config width is a ceiling, not a fixed size: a 17m banner suits a 24m
     transport plane and swamps a 9m slab of stone, so each craft caps it at
     something it can actually carry. */
  const bannerSize = useMemo<[number, number]>(() => {
    const width = Math.min(cfg.bannerWidth, anchor.maxWidth);
    if (!banner) return [width, width * 0.6];
    const image = banner.image as { width?: number; height?: number } | undefined;
    const aspect = image?.width && image?.height ? image.width / image.height : 1.6;
    return [width, width / aspect];
  }, [banner, cfg.bannerWidth, anchor.maxWidth]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;

    const t = (state.clock.elapsedTime / cfg.orbitSeconds) * Math.PI * 2;

    // Circle the map, tilted so it climbs and falls rather than sliding round
    // at one dead height.
    g.position.set(
      Math.sin(t) * cfg.radius,
      cfg.height +
        Math.sin(t) * cfg.radius * cfg.tilt +
        Math.sin(state.clock.elapsedTime * 0.35) * flight.bob,
      Math.cos(t) * cfg.radius + 26,
    );

    // Point along the direction of travel: the tangent to the circle.
    g.rotation.y = t + Math.PI / 2;

    if (body.current) {
      body.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.15) * flight.bank;
      if (flight.tumble) {
        body.current.rotation.x = state.clock.elapsedTime * 0.07;
        body.current.rotation.y = state.clock.elapsedTime * 0.05;
      }
    }
  });

  if (!cfg.enabled) return null;

  return (
    <group ref={group} scale={cfg.scale}>
      <group ref={body}>
        <Form color={hullColor} glow={primary} />
      </group>

      {/* The banner, on the flank that faces the map. */}
      {banner && (
        <group position={anchor.position} rotation={anchor.rotation}>
          <mesh>
            <planeGeometry args={bannerSize} />
            <meshBasicMaterial
              map={banner}
              transparent
              opacity={0.95}
              side={THREE.DoubleSide}
              toneMapped={false}
              fog={false}
            />
          </mesh>
          <mesh position={[0, 0, -0.06]}>
            <planeGeometry args={[bannerSize[0] + 0.9, bannerSize[1] + 0.9]} />
            <meshBasicMaterial
              color={accent}
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
              toneMapped={false}
              depthWrite={false}
              fog={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};
