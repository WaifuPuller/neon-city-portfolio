import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { portfolio } from '../../config/portfolio';
import { playerState } from '../../systems/input';
import {
  analyseJump,
  loadAllClips,
  loadModel,
  MotionState,
  resolveAllClips,
} from '../../systems/characterLoader';
import {
  JUMP_AIRTIME,
  MOVE_THRESHOLD,
  RUN_THRESHOLD,
  SPRINT_SPEED,
  WALK_SPEED,
} from '../../systems/movement';
import { AvatarFallback } from './AvatarFallback';

/* ---------------------------------------------------------------------------
 * Loads the avatar and drives its animation from the shared player snapshot,
 * so movement code and rendering stay decoupled and neither re-renders React
 * every frame.
 *
 * Deliberately forgiving about what it is handed: .glb, .gltf and .fbx all
 * work, the model is auto-scaled and planted on the ground whatever units it
 * was authored in, and clip names are matched loosely because every asset pack
 * names things differently.
 * ------------------------------------------------------------------------- */

/** A promise cache, so React StrictMode's double mount loads the model once. */
const modelCache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>();

function getModel(url: string, extraUrls: readonly string[]) {
  const key = `${url}::${extraUrls.join(',')}`;
  let entry = modelCache.get(key);

  if (!entry) {
    entry = (async () => {
      const [base, extra] = await Promise.all([
        loadModel(url),
        extraUrls.length > 0 ? loadAllClips(extraUrls) : Promise.resolve([]),
      ]);
      return { scene: base.scene, animations: [...base.animations, ...extra] };
    })();
    modelCache.set(key, entry);
  }
  return entry;
}

export const CharacterModel: React.FC = () => {
  const inner = useRef<THREE.Group>(null);
  const config = portfolio.character;

  const [loaded, setLoaded] = useState<{
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  } | null>(null);
  const [failed, setFailed] = useState<Error | null>(null);

  /* --------------------------------------------------------------- loading */
  useEffect(() => {
    let cancelled = false;

    getModel(config.modelUrl, config.animationUrls)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((err: Error) => {
        // Surfaced to the boundary below, which swaps in the built-in avatar.
        if (!cancelled) setFailed(err);
      });

    return () => {
      cancelled = true;
    };
  }, [config.modelUrl, config.animationUrls]);

  // Rethrow during render so CanvasErrorBoundary can catch it.
  if (failed) throw failed;

  // Something is always on screen: the procedural avatar stands in for the
  // few hundred milliseconds the model takes to arrive.
  if (!loaded) return <AvatarFallback />;
  return <Rig scene={loaded.scene} animations={loaded.animations} innerRef={inner} />;
};

/* ------------------------------------------------------------------- rig --- */

const Rig: React.FC<{
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  innerRef: React.RefObject<THREE.Group>;
}> = ({ scene, animations, innerRef }) => {
  const config = portfolio.character;

  // Clone so the cached model is never mutated and two mounts cannot fight
  // over one skeleton.
  const cloned = useMemo(() => SkeletonUtils.clone(scene) as THREE.Group, [scene]);
  const { actions, mixer } = useAnimations(animations, innerRef);

  /* ------------------------------------------------- fit to the world scale */
  const fit = useMemo(() => {
    // World matrices must be current or the box comes back as garbage for a
    // freshly cloned skinned hierarchy.
    cloned.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Mixamo exports in centimetres, most GLB packs in metres. Fitting by
    // bounding box makes the difference irrelevant.
    const height = size.y > 0.001 ? size.y : 1;
    const scale = config.height / height;
    const result = { scale, offsetY: -box.min.y * scale };

    if (import.meta.env.DEV) {
      console.info(
        `[portfolio] model bounds ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}, ` +
          `scaled by ${scale.toFixed(3)} to reach ${config.height}m`,
      );
    }
    return result;
  }, [cloned, config.height]);

  /* ------------------------------------------------------- resolve the clips */
  const clips = useMemo(() => {
    const available = animations.map((a) => a.name);
    const resolved = resolveAllClips(available, config.clips);

    if (import.meta.env.DEV) {
      console.info(`[portfolio] character loaded with ${available.length} clips:`, available);
      console.info('[portfolio] mapped to motion states:', resolved);

      const missing = (['idle', 'walk', 'run', 'jump'] as MotionState[]).filter(
        (k) => !resolved[k],
      );
      if (missing.length) {
        console.warn(
          `[portfolio] no clip matched for: ${missing.join(', ')}. Either add an ` +
            'animation file for it, or set the exact clip name in ' +
            'portfolio.character.clips.',
        );
      }
    }
    return resolved;
  }, [animations, config.clips]);

  /**
   * How the jump clip maps onto the actual arc the body follows.
   *
   * `offset` skips the anticipation crouch, since velocity is applied the
   * instant the key is pressed. `rate` stretches the airborne section of the
   * clip to match how long the character is really off the ground, so the feet
   * touch down at the same moment in both. `hold` is the last frame before the
   * landing pose, used to freeze the descent during a longer fall - otherwise
   * the character stands in a knees-bent landing pose in mid-air and only then
   * drops the rest of the way.
   */
  const jump = useMemo(() => {
    const none = { offset: 0, rate: 1, hold: Infinity };
    if (!clips.jump) return none;

    const clip = animations.find((a) => a.name === clips.jump);
    if (!clip) return none;

    const { takeoff, landing } = analyseJump(clip);
    const airborneInClip = landing - takeoff;
    if (airborneInClip <= 0.01) return none;

    // Clamped: a wildly mismatched clip should be nudged, not played at 4x.
    const rate = THREE.MathUtils.clamp(airborneInClip / JUMP_AIRTIME, 0.35, 2.5);

    if (import.meta.env.DEV) {
      console.info(
        `[portfolio] jump clip: takeoff ${takeoff.toFixed(2)}s, landing ` +
          `${landing.toFixed(2)}s (${airborneInClip.toFixed(2)}s airborne) vs ` +
          `${JUMP_AIRTIME.toFixed(2)}s of real airtime -> playing at ${rate.toFixed(2)}x`,
      );
    }
    // Hold a hair before touchdown so the landing pose never shows mid-air.
    return { offset: takeoff, rate, hold: Math.max(takeoff, landing - 0.06) };
  }, [animations, clips.jump]);

  /* Shadows on every mesh in the model. */
  useEffect(() => {
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        // Skinned meshes get culled incorrectly when the root does not move
        // the way three expects; the avatar is always on screen anyway.
        mesh.frustumCulled = false;
      }
    });
  }, [cloned]);

  /* ----------------------------------------------------------- state machine */
  const current = useRef<MotionState | null>(null);

  useEffect(() => {
    const name = clips.idle;
    if (name && actions[name]) {
      actions[name]!.reset().fadeIn(0.2).play();
      current.current = 'idle';
    }
    return () => {
      mixer.stopAllAction();
    };
  }, [actions, clips, mixer]);

  useFrame(() => {
    const speed = playerState.speed;

    let next: MotionState;
    if (!playerState.grounded) {
      // Prefer a dedicated falling loop; a jump clip left to hang on its last
      // frame looks frozen on a long drop.
      next = clips.fall ? 'fall' : 'jump';
    } else if (speed > RUN_THRESHOLD) {
      next = 'run';
    } else if (speed > MOVE_THRESHOLD) {
      next = 'walk';
    } else {
      next = 'idle';
    }

    // Walk down the chain if a pack is missing that clip.
    if (!clips[next]) {
      if (next === 'fall') next = clips.jump ? 'jump' : 'idle';
      else if (next === 'run') next = clips.walk ? 'walk' : 'idle';
      else if (next === 'walk') next = 'idle';
      else next = 'idle';
    }
    if (!clips[next]) return;

    if (next !== current.current) {
      const from = current.current ? clips[current.current] : null;
      const to = clips[next];

      if (to && actions[to]) {
        const action = actions[to]!;
        const once = next === 'jump';
        action.reset();
        action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = once;
        // Start at the launch frame rather than the crouch, and play the
        // airborne section at whatever rate makes it land when the body does.
        if (next === 'jump') {
          action.time = jump.offset;
          action.timeScale = jump.rate;
        }
        action.fadeIn(once ? 0.06 : 0.16).play();
      }
      if (from && actions[from] && from !== to) {
        actions[from]!.fadeOut(0.16);
      }
      current.current = next;
    }

    // Match the cycle to actual ground speed so the feet do not skate.
    const active = current.current ? clips[current.current] : null;
    if (active && actions[active]) {
      const action = actions[active]!;
      if (current.current === 'jump') {
        // Falling from a rooftop takes far longer than a standing hop, so once
        // the clip reaches the frame just before touchdown, hold it there until
        // the feet are actually on something.
        if (!playerState.grounded && action.time >= jump.hold) {
          action.time = jump.hold;
        }
      } else if (current.current === 'walk') {
        action.timeScale = THREE.MathUtils.clamp(speed / WALK_SPEED, 0.45, 1.9);
      } else if (current.current === 'run') {
        action.timeScale = THREE.MathUtils.clamp(speed / SPRINT_SPEED, 0.6, 1.8);
      } else {
        action.timeScale = 1;
      }
    }
  });

  return (
    <group
      ref={innerRef}
      scale={fit.scale}
      position={[0, fit.offsetY, 0]}
      rotation={[0, THREE.MathUtils.degToRad(config.yawOffset), 0]}
    >
      <primitive object={cloned} />
    </group>
  );
};

export default CharacterModel;
