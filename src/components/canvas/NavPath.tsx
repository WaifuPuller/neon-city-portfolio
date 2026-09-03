import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useGameStore } from '../../store/useGameStore';
import { playerState } from '../../systems/input';
import { groundHeightAt } from '../../systems/collision';
import { sampleRoute } from '../../systems/navigation';
import { navState, updateNav } from '../../systems/navState';

/* ---------------------------------------------------------------------------
 * Waypoint arrows painted along the street.
 *
 * The route itself comes from the A* grid in systems/navigation, so the trail
 * always follows walkable ground and never points through a building. Every
 * arrow is one instance of a single mesh, so the whole trail costs one draw
 * call however long it is.
 * ------------------------------------------------------------------------- */

const MAX_ARROWS = 44;
const SPACING = 4.2;

/** How close counts as having arrived. */
const ARRIVAL_RADIUS = 3.5;

/** A flat chevron lying in the XZ plane, pointing towards +Z. */
function makeChevron() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.62);
  shape.lineTo(0.58, -0.16);
  shape.lineTo(0.32, -0.44);
  shape.lineTo(0, 0.06);
  shape.lineTo(-0.32, -0.44);
  shape.lineTo(-0.58, -0.16);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  // ShapeGeometry builds in XY; tip it onto the ground so +Y becomes +Z.
  geo.rotateX(Math.PI / 2);
  return geo;
}

const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _colour = new THREE.Color();

export const NavPath: React.FC = () => {
  const navTarget = useGameStore((s) => s.navTarget);
  const arrows = useRef<THREE.InstancedMesh>(null);
  const beacon = useRef<THREE.Group>(null);

  const geometry = useMemo(() => makeChevron(), []);

  useFrame((state, delta) => {
    const store = useGameStore.getState();
    const target = store.navTarget;
    const mesh = arrows.current;

    updateNav(target, playerState.x, playerState.z, state.clock.elapsedTime);

    if (!target || !mesh) {
      if (mesh) mesh.count = 0;
      return;
    }

    /* ------------------------------------------------------------- arrival */
    const gap = Math.hypot(
      target.position[0] - playerState.x,
      target.position[2] - playerState.z,
    );
    if (gap < ARRIVAL_RADIUS) {
      store.setNavTarget(null);
      store.pushToast({
        kind: 'quest',
        title: 'ARRIVED',
        body: target.name,
        icon: 'map-pin',
      });
      mesh.count = 0;
      return;
    }

    /* -------------------------------------------------------------- arrows */
    const route = navState.route;
    if (!route) {
      mesh.count = 0;
      return;
    }

    const points = sampleRoute(route, SPACING, MAX_ARROWS);
    const time = state.clock.elapsedTime;
    _colour.set(target.color);

    /* How far along the route the player has walked since it was planned.
       The route is only replanned a couple of times a second, and at a sprint
       that is five metres — so without this the first arrow or two would be
       left sitting behind the character, pointing at their back. */
    const progress = Math.hypot(
      playerState.x - route.points[0][0],
      playerState.z - route.points[0][1],
    );

    let n = 0;
    for (const p of points) {
      // Skip the arrows underfoot and behind; they only clutter the view.
      if (p.travelled < progress + 1.6) continue;

      _pos.set(p.x, groundHeightAt(p.x, p.z) + 0.06, p.z);
      _quat.setFromAxisAngle(_up, Math.atan2(p.dirX, p.dirZ));

      // A brightness wave running from the player towards the destination,
      // which reads as "go that way" far more clearly than static markers.
      const wave = (p.travelled - time * 8) / 16;
      const f = wave - Math.floor(wave);
      const pulse = 0.3 + 0.7 * Math.pow(1 - f, 2.4);

      // Shrink into the distance so the trail does not fight the skyline.
      const ahead = p.travelled - progress;
      const fade = THREE.MathUtils.clamp(1 - ahead / 90, 0.35, 1);
      _scale.setScalar(fade);

      _matrix.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(n, _matrix);
      mesh.setColorAt(n, _colour.clone().multiplyScalar(pulse));
      n += 1;
    }

    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    /* -------------------------------------------------------------- beacon */
    if (beacon.current) {
      const y = groundHeightAt(target.position[0], target.position[2]);
      beacon.current.position.set(target.position[0], y + 0.05, target.position[2]);
      beacon.current.rotation.y += delta * 0.8;
    }
  });

  if (!navTarget) return null;

  return (
    <>
      <instancedMesh
        ref={arrows}
        args={[geometry, undefined, MAX_ARROWS]}
        frustumCulled={false}
        renderOrder={2}
      >
        <meshBasicMaterial
          transparent
          opacity={0.92}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* Destination beacon: a slowly turning ring with a soft column of light. */}
      <group ref={beacon}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.2, 2.6, 32]} />
          <meshBasicMaterial
            color={navTarget.color}
            transparent
            opacity={0.75}
            toneMapped={false}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.1, 3.25, 4]} />
          <meshBasicMaterial
            color={navTarget.color}
            transparent
            opacity={0.5}
            toneMapped={false}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 7, 0]}>
          <cylinderGeometry args={[1.1, 1.7, 14, 16, 1, true]} />
          <meshBasicMaterial
            color={navTarget.color}
            transparent
            opacity={0.09}
            toneMapped={false}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
};
