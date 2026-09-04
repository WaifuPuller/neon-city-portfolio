import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { media, orbiterImageUrl } from '../../config/media';
import { useOptionalTextures } from '../../hooks/useOptionalTextures';

/* ---------------------------------------------------------------------------
 * A craft circling the outside of the map, carrying the owner's banner.
 *
 * It flies well beyond WORLD_BOUNDS, so it is always scenery and never
 * something the player can reach or collide with - which is why it needs no
 * entry in world.ts and does not affect routing or the maps.
 *
 * Its materials opt out of fog. Fog is there to hide the far edge of the
 * ground plane, and at this distance it would swallow the craft completely on
 * the lower quality settings; in vacuum there is nothing to be hazy anyway.
 * ------------------------------------------------------------------------- */

const Hull: React.FC<{ color: string; glow: string }> = ({ color, glow }) => (
  <group>
    {/* Main body */}
    <mesh>
      <capsuleGeometry args={[1.9, 12, 6, 14]} />
      <meshStandardMaterial color={color} roughness={0.42} metalness={0.85} fog={false} />
    </mesh>

    {/* Spine, so the silhouette is not just a pill */}
    <mesh position={[0, 1.6, 0]}>
      <boxGeometry args={[1.1, 1.5, 9]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.8} fog={false} />
    </mesh>

    {/* Wings */}
    {[-1, 1].map((side) => (
      <mesh key={side} position={[side * 3.4, -0.4, -1.4]} rotation={[0, 0, side * 0.22]}>
        <boxGeometry args={[5.2, 0.4, 5.4]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.8} fog={false} />
      </mesh>
    ))}

    {/* Engines, and their glow */}
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

    {/* Running lights */}
    <mesh position={[0, 1.6, 6.6]}>
      <sphereGeometry args={[0.4, 8, 6]} />
      <meshBasicMaterial color={glow} toneMapped={false} fog={false} />
    </mesh>
  </group>
);

const Asteroid: React.FC<{ color: string }> = ({ color }) => {
  /* A sphere pushed around by a hash, so it is lumpy but still deterministic -
     the same rock every visit, like everything else in the world. */
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

export const Orbiter: React.FC<{ primary: string; accent: string }> = ({ primary, accent }) => {
  const cfg = media.orbiter;
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);

  const textures = useOptionalTextures(orbiterImageUrl ? [orbiterImageUrl] : []);
  const banner = orbiterImageUrl ? textures[orbiterImageUrl] : undefined;

  const bannerSize = useMemo<[number, number]>(() => {
    if (!banner) return [cfg.bannerWidth, cfg.bannerWidth * 0.6];
    const image = banner.image as { width?: number; height?: number } | undefined;
    const aspect = image?.width && image?.height ? image.width / image.height : 1.6;
    return [cfg.bannerWidth, cfg.bannerWidth / aspect];
  }, [banner, cfg.bannerWidth]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;

    const t = (state.clock.elapsedTime / cfg.orbitSeconds) * Math.PI * 2;

    // Circle the map, tilted so it climbs and falls rather than sliding round
    // at one dead height.
    g.position.set(
      Math.sin(t) * cfg.radius,
      cfg.height + Math.sin(t) * cfg.radius * cfg.tilt,
      Math.cos(t) * cfg.radius + 26,
    );

    // Point along the direction of travel: the tangent to the circle.
    g.rotation.y = t + Math.PI / 2;

    if (body.current) {
      // A slow roll, so it never looks frozen.
      body.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.15) * 0.12;
      if (cfg.kind === 'asteroid') {
        body.current.rotation.x = state.clock.elapsedTime * 0.07;
        body.current.rotation.y = state.clock.elapsedTime * 0.05;
      }
    }
  });

  if (!cfg.enabled) return null;

  return (
    <group ref={group} scale={cfg.scale}>
      <group ref={body}>
        {cfg.kind === 'asteroid' ? (
          <Asteroid color={cfg.color} />
        ) : (
          <Hull color={cfg.color} glow={primary} />
        )}
      </group>

      {/* The banner, mounted on the flank that faces the map. Rotating the
          craft to point along its path puts the map on its left-hand side, so
          the panel is offset and turned that way rather than sitting on the
          outside where nobody could ever read it. */}
      {banner && (
        <group position={[-4.4, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
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
