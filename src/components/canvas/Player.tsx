import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { input, playerState, takeLook } from '../../systems/input';
import { castCameraRay, groundHeightAt, moveWithCollision } from '../../systems/collision';
import { audio } from '../../utils/audioSynth';
import {
  ACCEL,
  AIR_TURN_RATE,
  GRAVITY,
  JUMP_VELOCITY,
  SPRINT_SPEED,
  steerVelocity,
  TURN_RATE,
  WALK_SPEED,
} from '../../systems/movement';
import { AvatarFallback } from './AvatarFallback';
import { CharacterModel } from './CharacterModel';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { portfolio } from '../../config/portfolio';

const EYE_HEIGHT = 1.35;

const CAM_DISTANCE = 7.4;
const CAM_HEIGHT = 2.5;

/** Reused scratch vectors so the frame loop allocates nothing. */
const _camTarget = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

export const Player: React.FC = () => {
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null);

  const pos = useRef(new THREE.Vector3(0, 1.1, 0));
  const vel = useRef(new THREE.Vector3());
  // Start facing north (+Z) up the boulevard, which is where the first
  // objective sits. Camera sits behind at -Z.
  const yaw = useRef(Math.PI);
  const pitch = useRef(0.22);
  const grounded = useRef(true);
  const wasJumpDown = useRef(false);
  const stepTimer = useRef(0);
  const facing = useRef(0);
  const camDist = useRef(CAM_DISTANCE);
  /** Camera position relative to the player, so following costs no lag. */
  const camOffset = useRef(new THREE.Vector3());
  const camReady = useRef(false);

  useFrame((_state, rawDelta) => {
    const store = useGameStore.getState();
    const { phase, activeModal } = store;
    const g = group.current;
    if (!g) return;

    // Clamp delta so an alt-tab does not teleport the player through a wall.
    const delta = Math.min(rawDelta, 1 / 20);
    const controllable = phase === 'PLAYING' && activeModal === null;

    /* ------------------------------------------------------------ teleport */
    if (store.teleportTarget) {
      const [tx, ty, tz] = store.teleportTarget;
      pos.current.set(tx, Math.max(ty, groundHeightAt(tx, tz) + 1.1), tz);
      vel.current.set(0, 0, 0);
      store.clearTeleport();
    }

    /* ---------------------------------------------------------------- look */
    if (controllable) {
      const [lx, ly] = takeLook();
      yaw.current -= lx;
      pitch.current = THREE.MathUtils.clamp(pitch.current + ly, -0.45, 1.15);
    } else {
      takeLook(); // drain, so buffered movement does not snap on resume
    }

    /* ------------------------------------------------------------ movement */
    const forwardVec = { x: -Math.sin(yaw.current), z: -Math.cos(yaw.current) };
    const rightVec = { x: Math.cos(yaw.current), z: -Math.sin(yaw.current) };

    let wishX = 0;
    let wishZ = 0;
    if (controllable) {
      wishX = forwardVec.x * input.forward + rightVec.x * input.strafe;
      wishZ = forwardVec.z * input.forward + rightVec.z * input.strafe;
      const len = Math.hypot(wishX, wishZ);
      if (len > 1) {
        wishX /= len;
        wishZ /= len;
      }
    }

    const moving = wishX !== 0 || wishZ !== 0;
    const sprinting = controllable && input.sprint && moving;
    const targetSpeed = sprinting ? SPRINT_SPEED : WALK_SPEED;

    /* Reduced air control keeps jumps feeling committed.

       Steering rotates the momentum towards the wanted heading rather than
       damping X and Z independently towards it. Independent damping had to
       bleed all the way down through zero before it could build speed the
       other way, and although that takes the same TIME at any speed, at a
       sprint the character covers metres of ground doing it — which is why
       turning while already sprinting felt like it did nothing, while
       sprinting after the turn felt fine. */
    const control = grounded.current ? ACCEL : ACCEL * 0.35;
    [vel.current.x, vel.current.z] = steerVelocity(
      vel.current.x,
      vel.current.z,
      wishX,
      wishZ,
      targetSpeed,
      control,
      grounded.current ? TURN_RATE : AIR_TURN_RATE,
      delta,
    );

    /* ---------------------------------------------------------------- jump */
    if (controllable && input.jump && !wasJumpDown.current && grounded.current) {
      vel.current.y = JUMP_VELOCITY;
      grounded.current = false;
      audio.jump();
      store.unlockAchievement('airborne');
    }
    wasJumpDown.current = controllable && input.jump;

    /* ------------------------------------------------------------- gravity */
    vel.current.y -= GRAVITY * delta;

    /* --------------------------------------------------- horizontal + solid */
    const result = moveWithCollision(
      pos.current.x,
      pos.current.z,
      vel.current.x * delta,
      vel.current.z * delta,
      pos.current.y - 1.1,
    );
    pos.current.x = result.x;
    pos.current.z = result.z;

    // Vertical integration against whatever surface is underneath.
    pos.current.y += vel.current.y * delta;
    const floor = result.groundY + 1.1;
    if (pos.current.y <= floor) {
      if (!grounded.current && vel.current.y < -6) audio.land();
      pos.current.y = floor;
      vel.current.y = 0;
      grounded.current = true;
    } else {
      grounded.current = false;
    }

    /* ---------------------------------------------------- achievement hooks */
    const speed2D = Math.hypot(vel.current.x, vel.current.z);
    if (speed2D > 0.5) {
      playerState.distanceTravelled += speed2D * delta;
      if (playerState.distanceTravelled > 6) store.unlockAchievement('first-steps');
      if (sprinting) store.unlockAchievement('sprinter');
    }
    if (result.groundY > 8 && grounded.current) store.unlockAchievement('rooftop');

    /* ------------------------------------------------------------ animation */
    // The avatar drives its own limbs from the shared player snapshot; all
    // this loop owns is which way the body faces and when a foot lands.
    if (moving && grounded.current) {
      // Face the way the body is actually travelling once there is real
      // momentum to read, so a turn shows the character leaning into the arc
      // instead of snapping to a heading it has not reached yet. Below
      // walking pace the velocity is too small to give a stable angle, so the
      // requested direction is used instead.
      const vSpeed = Math.hypot(vel.current.x, vel.current.z);
      facing.current =
        vSpeed > 1
          ? Math.atan2(vel.current.x, vel.current.z)
          : Math.atan2(wishX, wishZ);

      stepTimer.current -= delta;
      if (stepTimer.current <= 0) {
        audio.footstep(sprinting);
        stepTimer.current = sprinting ? 0.24 : 0.38;
      }
    } else {
      stepTimer.current = 0;
    }

    // Shortest-path rotation towards the facing direction.
    let diff = facing.current - g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    g.rotation.y += diff * Math.min(1, delta * 14);

    // Feet sit on the ground plane; pos.y tracks the capsule centre.
    g.position.set(pos.current.x, pos.current.y - 1.1, pos.current.z);

    /* --------------------------------------------------------------- camera */
    if (phase === 'PLAYING' || phase === 'PAUSED') {
      const cp = Math.cos(pitch.current);
      const dirX = Math.sin(yaw.current) * cp;
      const dirZ = Math.cos(yaw.current) * cp;

      // Pull the camera in if a building is between it and the player.
      const wanted = castCameraRay(
        pos.current.x,
        pos.current.z,
        dirX,
        dirZ,
        CAM_DISTANCE,
        pos.current.y,
      );
      camDist.current = THREE.MathUtils.damp(camDist.current, wanted, 9, delta);

      /* Where the camera wants to sit RELATIVE to the player. */
      _camTarget.set(
        dirX * camDist.current,
        CAM_HEIGHT + Math.sin(pitch.current) * camDist.current * 0.85,
        dirZ * camDist.current,
      );

      /* Smooth the OFFSET, never the world position.
       *
       * Easing the world position towards a target that is itself running
       * away at the player's speed leaves a permanent lag of speed/rate
       * metres: about 0.7m at a walk but 1.2m at a sprint. Turning then swings
       * the camera through a wide arc it can never catch up with, so the
       * faster you were going the less the view appeared to answer the mouse —
       * which is exactly "it will not change direction while sprinting", while
       * turning first and then sprinting felt fine.
       *
       * Anchoring to the player removes the speed term entirely: the camera
       * responds identically at a standstill and at a full sprint, and only
       * the orbit around the player is eased. */
      if (!camReady.current) {
        camOffset.current.copy(_camTarget);
        camReady.current = true;
      } else {
        camOffset.current.x = THREE.MathUtils.damp(camOffset.current.x, _camTarget.x, 16, delta);
        camOffset.current.y = THREE.MathUtils.damp(camOffset.current.y, _camTarget.y, 16, delta);
        camOffset.current.z = THREE.MathUtils.damp(camOffset.current.z, _camTarget.z, 16, delta);
      }

      camera.position.set(
        pos.current.x + camOffset.current.x,
        pos.current.y + camOffset.current.y,
        pos.current.z + camOffset.current.z,
      );

      // Never let the camera clip below the street or a rooftop.
      const camFloor = groundHeightAt(camera.position.x, camera.position.z) + 0.8;
      if (camera.position.y < camFloor) camera.position.y = camFloor;

      _lookAt.set(
        pos.current.x - forwardVec.x * 1.4,
        pos.current.y + EYE_HEIGHT - Math.sin(pitch.current) * 1.2,
        pos.current.z - forwardVec.z * 1.4,
      );
      camera.lookAt(_lookAt);
    }

    /* ------------------------------------------------------ shared snapshot */
    playerState.x = pos.current.x;
    playerState.y = pos.current.y;
    playerState.z = pos.current.z;
    playerState.yaw = yaw.current;
    playerState.speed = speed2D;
    playerState.grounded = grounded.current;

    /* --------------------------------------------------- proximity triggers */
    if (controllable) {
      let nearest = null;
      let best = Infinity;
      for (const zone of store.zones) {
        const d = Math.hypot(pos.current.x - zone.position[0], pos.current.z - zone.position[2]);
        if (d < zone.radius && d < best) {
          best = d;
          nearest = zone;
        }
      }
      store.setNearbyZone(nearest);

      for (const core of store.collectibles) {
        if (core.collected) continue;
        const d = Math.hypot(
          pos.current.x - core.position[0],
          pos.current.z - core.position[2],
        );
        if (d < 2 && Math.abs(pos.current.y - core.position[1]) < 3) {
          store.collectCore(core.id);
        }
      }
    }
  });

  return (
    <group ref={group} position={[0, 0, 0]} rotation={[0, 0, 0]}>
      {/* The GLB avatar, with the procedural one standing in while it streams
          and permanently if the file is missing or fails to parse. */}
      {portfolio.character.modelUrl ? (
        <CanvasErrorBoundary fallback={<AvatarFallback />}>
          <CharacterModel />
        </CanvasErrorBoundary>
      ) : (
        <AvatarFallback />
      )}

      {/* Cheap contact shadow — reads well even with real shadows disabled. */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.42} />
      </mesh>
    </group>
  );
};
