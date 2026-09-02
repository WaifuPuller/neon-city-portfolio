import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { playerState } from '../../systems/input';
import { MOVE_THRESHOLD, RUN_THRESHOLD } from '../../systems/movement';

/* ---------------------------------------------------------------------------
 * Procedural blocky avatar.
 *
 * Used while the GLB streams in, and permanently if no model file is present
 * or it fails to load. Entirely code-generated, so the site always has a
 * character to walk around as — there is no state in which the player is
 * invisible.
 * ------------------------------------------------------------------------- */

export const AvatarFallback: React.FC = () => {
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const visor = useRef<THREE.MeshBasicMaterial>(null);
  const body = useRef<THREE.Group>(null);

  const cycle = useRef(0);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    const speed = playerState.speed;
    const moving = speed > MOVE_THRESHOLD && playerState.grounded;
    const running = speed > RUN_THRESHOLD;

    cycle.current += delta * (moving ? (running ? 15 : 9.5) : 1.6);

    const swing = moving ? Math.sin(cycle.current) * (running ? 0.85 : 0.55) : 0;
    const idle = Math.sin(state.clock.elapsedTime * 1.8) * 0.05;

    if (leftArm.current)
      leftArm.current.rotation.x = THREE.MathUtils.damp(leftArm.current.rotation.x, swing + idle, 12, delta);
    if (rightArm.current)
      rightArm.current.rotation.x = THREE.MathUtils.damp(rightArm.current.rotation.x, -swing + idle, 12, delta);
    if (leftLeg.current)
      leftLeg.current.rotation.x = THREE.MathUtils.damp(leftLeg.current.rotation.x, -swing, 12, delta);
    if (rightLeg.current)
      rightLeg.current.rotation.x = THREE.MathUtils.damp(rightLeg.current.rotation.x, swing, 12, delta);

    // Vertical bob while moving.
    if (body.current) {
      const bob = moving ? Math.abs(Math.sin(cycle.current)) * 0.045 : 0;
      body.current.position.y = bob;
    }
    if (visor.current) {
      visor.current.opacity = 0.72 + Math.sin(state.clock.elapsedTime * 3) * 0.22;
    }
  });

  return (
    <group ref={body}>
      {/* Head */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <capsuleGeometry args={[0.19, 0.12, 4, 12]} />
        <meshStandardMaterial color="#e8b98a" roughness={0.75} />
      </mesh>

      {/* Hood */}
      <mesh position={[0, 1.74, -0.02]} castShadow>
        <sphereGeometry args={[0.235, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color="#111827" roughness={0.55} metalness={0.25} />
      </mesh>

      {/* Visor */}
      <mesh position={[0, 1.62, 0.17]}>
        <boxGeometry args={[0.32, 0.085, 0.06]} />
        <meshBasicMaterial ref={visor} color="#22d3ee" transparent opacity={0.9} toneMapped={false} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 1.14, 0]} castShadow>
        <boxGeometry args={[0.52, 0.72, 0.3]} />
        <meshStandardMaterial color="#0f172a" roughness={0.42} metalness={0.6} />
      </mesh>

      {/* Chest reactor */}
      <mesh position={[0, 1.2, 0.16]}>
        <circleGeometry args={[0.075, 16]} />
        <meshBasicMaterial color="#f472b6" toneMapped={false} />
      </mesh>

      {/* Shoulder trim */}
      <mesh position={[0, 1.46, 0]}>
        <boxGeometry args={[0.58, 0.06, 0.34]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>

      {/* Arms — pivot at the shoulder */}
      <group position={[-0.35, 1.42, 0]}>
        <mesh ref={leftArm} position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.15, 0.62, 0.16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.35} />
        </mesh>
      </group>
      <group position={[0.35, 1.42, 0]}>
        <mesh ref={rightArm} position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.15, 0.62, 0.16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.35} />
        </mesh>
      </group>

      {/* Legs — pivot at the hip */}
      <group position={[-0.14, 0.78, 0]}>
        <mesh ref={leftLeg} position={[0, -0.36, 0]} castShadow>
          <boxGeometry args={[0.19, 0.76, 0.2]} />
          <meshStandardMaterial color="#0369a1" roughness={0.45} metalness={0.4} />
        </mesh>
      </group>
      <group position={[0.14, 0.78, 0]}>
        <mesh ref={rightLeg} position={[0, -0.36, 0]} castShadow>
          <boxGeometry args={[0.19, 0.76, 0.2]} />
          <meshStandardMaterial color="#0369a1" roughness={0.45} metalness={0.4} />
        </mesh>
      </group>
    </group>
  );
};
