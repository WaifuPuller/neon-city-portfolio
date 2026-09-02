import * as THREE from 'three';
import { FBXLoader, GLTFLoader } from 'three-stdlib';

/* ---------------------------------------------------------------------------
 * Format-agnostic character loading.
 *
 * Handles .glb / .gltf / .fbx so a model can be dropped straight in without a
 * Blender round-trip, and merges animation clips that live in separate files
 * (which is exactly what Mixamo hands you: one download per animation).
 * ------------------------------------------------------------------------- */

export type ModelFormat = 'gltf' | 'fbx';

export function formatOf(url: string): ModelFormat {
  return url.split('?')[0].toLowerCase().endsWith('.fbx') ? 'fbx' : 'gltf';
}

/** "/models/Falling Idle.fbx" -> "Falling Idle" */
export function basenameOf(url: string): string {
  const file = url.split('?')[0].split('/').pop() ?? url;
  return file.replace(/\.[^.]+$/, '');
}

/**
 * Clip names that carry no information and should be replaced by the filename.
 *
 * Mixamo names the clip in EVERY export "mixamo.com", so four downloads give
 * four identically-named clips and name matching collapses. FBX exporters also
 * love "Take 001" and "Armature|mixamo.com|Layer0".
 */
const USELESS_NAME = /^(mixamo\.com|take\s*\d+|animation\s*\d*|armature\|?.*mixamo.*|default|unnamed)?$/i;

function isUseless(name: string): boolean {
  return USELESS_NAME.test(name.trim());
}

/**
 * Give clips meaningful names, falling back to the filename they came from.
 * With one clip per file (the Mixamo case) the filename *is* the clip name,
 * which is what makes `Running.fbx` map itself to the run state.
 */
export function nameClips(clips: THREE.AnimationClip[], url: string): THREE.AnimationClip[] {
  const base = basenameOf(url);

  return clips.map((clip, i) => {
    if (!isUseless(clip.name)) return clip;
    const renamed = clip.clone();
    renamed.name = clips.length === 1 ? base : `${base}_${i + 1}`;
    return renamed;
  });
}


/* --------------------------------------------------------- root motion --- */

/** Bones that typically carry a character's whole-body displacement. */
const ROOT_BONE = /(hips|root|pelvis|armature|reference)/i;

/**
 * Remove horizontal travel baked into an animation.
 *
 * Mixamo clips downloaded WITHOUT the "In Place" option translate the whole
 * skeleton forward over the course of the cycle, then snap back when it loops.
 * Since the game moves the character itself, that reads as walking forward and
 * being yanked back again, over and over.
 *
 * X and Z on the root bone are frozen at their starting values; Y is kept, so
 * the natural bob of a walk or the arc of a jump survives. Clips that were
 * already in place are unaffected, because their X and Z are constant anyway.
 */
export function stripRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const positionTracks = clip.tracks.filter((t) => t.name.endsWith('.position'));
  if (positionTracks.length === 0) return clip;

  // Prefer a track whose bone name looks like a root; otherwise, if there is
  // exactly one position track in the whole clip, that is the root by
  // elimination (rigs animate rotation on every other bone).
  let targets = positionTracks.filter((t) => ROOT_BONE.test(t.name));
  if (targets.length === 0 && positionTracks.length === 1) targets = positionTracks;
  if (targets.length === 0) return clip;

  const targetNames = new Set(targets.map((t) => t.name));

  const tracks = clip.tracks.map((track) => {
    if (!targetNames.has(track.name)) return track;

    const cloned = track.clone();
    const v = cloned.values;
    const startX = v[0];
    const startZ = v[2];
    for (let i = 0; i + 2 < v.length; i += 3) {
      v[i] = startX;
      v[i + 2] = startZ;
      // v[i + 1] (Y) deliberately untouched.
    }
    return cloned;
  });

  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

/** Apply naming and root-motion cleanup in one step. */
function prepare(clips: THREE.AnimationClip[], url: string): THREE.AnimationClip[] {
  return nameClips(clips, url).map(stripRootMotion);
}

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

export interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

/** Load a character mesh from any supported format. */
export async function loadModel(url: string): Promise<LoadedModel> {
  if (formatOf(url) === 'fbx') {
    const group = await fbxLoader.loadAsync(url);
    return { scene: group, animations: prepare(group.animations ?? [], url) };
  }
  const gltf = await gltfLoader.loadAsync(url);
  return {
    scene: gltf.scene as THREE.Group,
    animations: prepare(gltf.animations ?? [], url),
  };
}

/** Load clips only, from a file whose mesh we do not care about. */
export async function loadClips(url: string): Promise<THREE.AnimationClip[]> {
  if (formatOf(url) === 'fbx') {
    const group = await fbxLoader.loadAsync(url);
    return prepare(group.animations ?? [], url);
  }
  const gltf = await gltfLoader.loadAsync(url);
  return prepare(gltf.animations ?? [], url);
}

/**
 * Load every extra animation file, tolerating individual failures.
 * A missing or corrupt animation should cost you that one clip, not the
 * whole character.
 */
export async function loadAllClips(urls: readonly string[]): Promise<THREE.AnimationClip[]> {
  const results = await Promise.allSettled(urls.map((url) => loadClips(url)));
  const clips: THREE.AnimationClip[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      clips.push(...result.value);
    } else {
      console.warn(
        `[portfolio] could not load animation "${urls[i]}" — skipping it.`,
        result.reason,
      );
    }
  });
  return clips;
}

/* ------------------------------------------------------------ clip matching */

export type MotionState = 'idle' | 'walk' | 'run' | 'jump' | 'fall';

/** Candidate names per state, in priority order, matched loosely. */
const CANDIDATES: Record<MotionState, string[]> = {
  idle: ['idle', 'breathingidle', 'stand', 'standing', 'basepose'],
  walk: ['walk', 'walking', 'walkforward', 'walkfwd'],
  run: ['run', 'running', 'sprint', 'runforward', 'jog', 'jogging'],
  jump: ['jump', 'jumping', 'jumpup', 'hop', 'leap'],
  fall: ['fall', 'falling', 'fallingidle', 'airborne', 'inair'],
};

/** Strip everything but letters and digits so "Armature|Run_01" matches "run". */
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Resolve one motion state to a clip name.
 *
 * Exact matches beat substring matches, so a plain "Walk" is not stolen by
 * "WalkBackwards" when both exist. "Falling Idle" is deliberately excluded
 * from the idle candidates by checking the more specific states first.
 */
export function resolveClip(
  state: MotionState,
  available: string[],
  override?: string,
): string | null {
  if (override && available.includes(override)) return override;

  const indexed = available.map((name) => ({ name, key: normalise(name) }));

  for (const candidate of CANDIDATES[state]) {
    const exact = indexed.find((c) => c.key === candidate);
    if (exact) return exact.name;
  }
  for (const candidate of CANDIDATES[state]) {
    const partial = indexed.find((c) => c.key.includes(candidate));
    if (partial) return partial.name;
  }
  return null;
}

/**
 * Map every motion state at once.
 *
 * `fall` is resolved first and its match removed from the pool, so a clip
 * called "Falling Idle" cannot also be claimed as the idle animation.
 */
export function resolveAllClips(
  available: string[],
  overrides: Partial<Record<MotionState, string>>,
): Record<MotionState, string | null> {
  const fall = resolveClip('fall', available, overrides.fall);
  const remaining = fall ? available.filter((n) => n !== fall) : available;

  return {
    fall,
    idle: resolveClip('idle', remaining, overrides.idle),
    walk: resolveClip('walk', remaining, overrides.walk),
    run: resolveClip('run', remaining, overrides.run),
    jump: resolveClip('jump', remaining, overrides.jump),
  };
}
