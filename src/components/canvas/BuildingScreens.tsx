import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildings, WORLD_BOUNDS } from '../../systems/world';
import { buildingImageUrls, media } from '../../config/media';
import { useOptionalTextures } from '../../hooks/useOptionalTextures';

/* ---------------------------------------------------------------------------
 * The owner's own pictures, mounted on the towers.
 *
 * One glowing panel per image, circling its host building so it is readable
 * from wherever the visitor happens to be standing rather than only from the
 * one side it was bolted to.
 *
 * Everything here is driven by whatever files are sitting in
 * src/assets/images/. No images, no panels, and nothing else in the scene
 * changes - the same rule the rest of the portfolio follows.
 * ------------------------------------------------------------------------- */

/** Keep panels off the towers pressed right up against the street. */
const MIN_DISTANCE_FROM_ROAD = 8;
/** ...and off the ones so far out that nobody would ever see them. */
const MAX_DISTANCE_FROM_ROAD = 46;
/**
 * The city is drawn slightly wider than the walkable map, to give the skyline
 * somewhere to fade out. A panel on one of those outer towers is stranded
 * behind the boundary wall where the player can never get near it, so hosts
 * are kept inside the part of the world you can actually reach.
 */
const EDGE_MARGIN = 6;

interface Mount {
  url: string;
  /** Centre of the host tower. */
  centre: [number, number, number];
  /** How far from the tower's axis the panel floats. */
  radius: number;
  /** Height above the ground the panel sits at. */
  y: number;
  /** Where in its lap this panel starts, so they are not all in step. */
  phase: number;
  /** Which way the panel faces when it is standing still. */
  fixedAngle: number;
}

const Panel: React.FC<{ mount: Mount; texture: THREE.Texture; accent: string }> = ({
  mount,
  texture,
  accent,
}) => {
  const group = useRef<THREE.Group>(null);

  /* Fit the picture to the panel without squashing it. Width is capped by the
     setting and by how much room the tower gives; height then follows from the
     image's own proportions. */
  const [w, h] = useMemo(() => {
    const image = texture.image as { width?: number; height?: number } | undefined;
    const aspect = image?.width && image?.height ? image.width / image.height : 1;
    let width = Math.min(media.buildingImages.maxWidth, mount.radius * 1.9);
    let height = width / aspect;
    // Very tall pictures would otherwise reach the ground; cap and re-derive.
    if (height > 9) {
      height = 9;
      width = height * aspect;
    }
    return [width, height];
  }, [texture, mount.radius]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;

    const angle =
      media.buildingImages.display === 'orbit'
        ? mount.phase +
          (state.clock.elapsedTime / media.buildingImages.orbitSeconds) * Math.PI * 2
        : mount.fixedAngle;

    g.position.set(
      mount.centre[0] + Math.sin(angle) * mount.radius,
      mount.y + Math.sin(state.clock.elapsedTime * 0.5 + mount.phase) * 0.22,
      mount.centre[2] + Math.cos(angle) * mount.radius,
    );
    // Face directly away from the tower, so the picture is never edge-on to
    // someone standing outside it.
    g.rotation.y = angle;
  });

  return (
    <group ref={group}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={media.buildingImages.opacity}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {media.buildingImages.frame && (
        <>
          {/* Glow behind the picture, so it reads as a lit screen rather than a
              sticker floating in the dark. */}
          <mesh position={[0, 0, -0.04]}>
            <planeGeometry args={[w + 0.5, h + 0.5]} />
            <meshBasicMaterial
              color={accent}
              transparent
              opacity={0.28}
              toneMapped={false}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* A bright lip along the bottom edge. */}
          <mesh position={[0, -h / 2 - 0.18, 0]}>
            <planeGeometry args={[w + 0.5, 0.1]} />
            <meshBasicMaterial
              color={accent}
              toneMapped={false}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </group>
  );
};

export const BuildingScreens: React.FC<{ accent: string }> = ({ accent }) => {
  const textures = useOptionalTextures(buildingImageUrls);

  /**
   * Which towers get a panel.
   *
   * Spread evenly along the boulevard rather than picked at random or by
   * height: the tallest towers are all out at the edges of the map, so
   * choosing those would hide every picture behind the skyline.
   */
  const mounts = useMemo<Mount[]>(() => {
    if (buildingImageUrls.length === 0) return [];

    const candidates = buildings
      .filter((b) => {
        const d = Math.abs(b.position[0]);
        if (d < MIN_DISTANCE_FROM_ROAD || d > MAX_DISTANCE_FROM_ROAD) return false;
        return (
          b.position[2] > WORLD_BOUNDS.minZ + EDGE_MARGIN &&
          b.position[2] < WORLD_BOUNDS.maxZ - EDGE_MARGIN
        );
      })
      .sort((a, b) => a.position[2] - b.position[2]);

    if (candidates.length === 0) return [];

    /* Pick hosts by WHERE THEY ARE, not by their position in the list.
       Stepping through the sorted list evenly sounds equivalent but is not:
       the towers themselves are clustered, because the landmark plots carve
       holes out of the middle of the city. That put half the pictures within a
       few paces of the spawn point and three more piled up together at the far
       end. Walking the length of the map in even strides and taking the
       nearest unused tower to each stop spreads them properly.

       The bands run south to north, so the pictures are met in filename
       order as the visitor walks up the boulevard. */
    const zFrom = WORLD_BOUNDS.minZ + EDGE_MARGIN;
    const zTo = WORLD_BOUNDS.maxZ - EDGE_MARGIN;
    const taken = new Set<number>();

    const hosts = buildingImageUrls.map((_, i) => {
      const targetZ = zFrom + ((i + 0.5) / buildingImageUrls.length) * (zTo - zFrom);

      let best = -1;
      let bestDistance = Infinity;
      candidates.forEach((candidate, index) => {
        if (taken.has(index)) return;
        const distance = Math.abs(candidate.position[2] - targetZ);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });

      if (best < 0) return null;
      taken.add(best);
      return candidates[best];
    });

    return buildingImageUrls.flatMap((url, i) => {
      const host = hosts[i];
      // More pictures than towers to hang them on: the extras are dropped
      // rather than doubled up on a tower that already has one.
      if (!host) return [];
      const [bw, bh, bd] = host.size;
      const base = host.position[1] - bh / 2;

      return [{
        url,
        centre: host.position,
        radius: Math.max(bw, bd) * 0.5 + 2.6,
        /* High enough to clear the lamp posts at 4.8m, low enough to read
           without craning your neck: at 8m up and ten paces back you are
           looking up about 35 degrees, where 11m was closer to 50. */
        y: base + Math.min(bh * 0.45, 8),
        phase: (i / buildingImageUrls.length) * Math.PI * 2,
        // Fixed panels turn to face the boulevard, which is at x = 0.
        fixedAngle: host.position[0] > 0 ? Math.PI / 2 : -Math.PI / 2,
      }];
    });
  }, []);

  return (
    <group>
      {mounts.map((mount) =>
        textures[mount.url] ? (
          <Panel key={mount.url} mount={mount} texture={textures[mount.url]} accent={accent} />
        ) : null,
      )}
    </group>
  );
};
