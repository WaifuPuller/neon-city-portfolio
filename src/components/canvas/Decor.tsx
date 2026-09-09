import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { DecorItem, GlowItem } from '../../systems/decor';

/* ---------------------------------------------------------------------------
 * Bulk instanced decoration, and a cheap stand-in for bloom.
 *
 * Both build their meshes imperatively rather than through drei's <Instances>.
 * That component makes one React element per instance, which is fine for the
 * forty buildings it was written for and completely wrong for four thousand
 * windows: the reconciler work alone would cost more than drawing them. Here
 * the matrices are written straight into the buffer once and never touched
 * again.
 * ------------------------------------------------------------------------- */

const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _colour = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

interface DecorProps {
  items: DecorItem[];
  /** 'plane' for flat things stuck on a wall, 'box' for things with depth. */
  shape?: 'plane' | 'box';
  /** Emissive surfaces ignore the lighting; solid ones are lit normally. */
  emissive?: boolean;
  color?: string;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  castShadow?: boolean;
}

export const Decor: React.FC<DecorProps> = ({
  items,
  shape = 'plane',
  emissive = false,
  color = '#ffffff',
  opacity = 1,
  roughness = 0.8,
  metalness = 0.1,
  castShadow = false,
}) => {
  const mesh = useMemo(() => {
    if (items.length === 0) return null;

    const geometry =
      shape === 'box' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.PlaneGeometry(1, 1);

    const material = emissive
      ? new THREE.MeshBasicMaterial({
          color,
          toneMapped: false,
          transparent: opacity < 1,
          opacity,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshStandardMaterial({ color, roughness, metalness });

    const instanced = new THREE.InstancedMesh(geometry, material, items.length);
    instanced.castShadow = castShadow;

    items.forEach((item, i) => {
      _pos.set(item.pos[0], item.pos[1], item.pos[2]);
      _quat.setFromAxisAngle(_up, item.rotY);
      _scale.set(item.scale[0], item.scale[1], item.scale[2]);
      _matrix.compose(_pos, _quat, _scale);
      instanced.setMatrixAt(i, _matrix);
      if (item.color) instanced.setColorAt(i, _colour.set(item.color));
    });

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;

    // The cloud spans the whole city, so a bounding sphere test can never cull
    // it usefully and only costs time to compute.
    instanced.frustumCulled = false;

    return instanced;
  }, [items, shape, emissive, color, opacity, roughness, metalness, castShadow]);

  // Geometry, materials and instance buffers all live on the graphics card and
  // are not garbage collected.
  useEffect(() => {
    if (!mesh) return;
    return () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    };
  }, [mesh]);

  if (!mesh) return null;
  return <primitive object={mesh} />;
};

/* ===========================================================================
 * GLOW
 *
 * Soft halos around light sources, for machines that cannot afford the bloom
 * pass. Points rather than quads, so the GPU billboards them and there is no
 * per-frame work at all.
 * ========================================================================= */

const glowVertex = /* glsl */ `
  attribute float aSize;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Perspective sizing: a halo has a real width in the world, so it has to
    // shrink with distance exactly as the thing it surrounds does.
    gl_PointSize = aSize * (300.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const glowFragment = /* glsl */ `
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    // Squared falloff, which reads as light spilling rather than a flat disc.
    float a = 1.0 - smoothstep(0.0, 1.0, d);
    a = a * a * 0.55;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

export const Glow: React.FC<{ items: GlowItem[] }> = ({ items }) => {
  const geometry = useMemo(() => {
    const positions = new Float32Array(items.length * 3);
    const colors = new Float32Array(items.length * 3);
    const sizes = new Float32Array(items.length);
    const c = new THREE.Color();

    items.forEach((item, i) => {
      positions[i * 3] = item.pos[0];
      positions[i * 3 + 1] = item.pos[1];
      positions[i * 3 + 2] = item.pos[2];
      c.set(item.color);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = item.size;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [items]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (items.length === 0) return null;

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={1}>
      <shaderMaterial
        vertexShader={glowVertex}
        fragmentShader={glowFragment}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
