import type { Timeline } from '@/audio/timeline';

/**
 * THE SOUND LAYER — ambient bed and spatial movement.
 *
 * Deliberately separate from intervention content, in every sense that
 * matters:
 *
 *   - It is bundled with the app rather than stored in the private intervention
 *     bucket, and it never appears in the intervention module table.
 *     (Both are named in `docs/ELSEA.md`; they are deliberately not written out
 *     here, because a client-source guard in `approval-gate.test.ts` forbids
 *     those literal strings anywhere under `src/` — including in a comment
 *     saying they are not used. That guard is worth more than the convenience
 *     of naming them.)
 *   - It carries no `technique_key`, no `approved` flag and no clinical
 *     meaning, because it is sound design rather than intervention.
 *   - It is generated deterministically by `scripts/generate-sound-assets.mjs`
 *     from synthesis primitives, so it can be rebuilt at any time and there is
 *     no master to lose.
 *
 * NO CLAIMS ATTACH TO ANY OF THIS. The carrier tones in the generator were
 * chosen because they are low, unobtrusive, and divide evenly into the asset
 * length so the bed loops without a seam. They are engineering parameters.
 * Nothing here treats, entrains or affects anyone's physiology, and nothing in
 * the product may describe it as doing so.
 *
 * WHY THE MOVEMENT IS BAKED IN. There is no runtime panning anywhere in this
 * project and none is being added: that would mean a DSP layer, a native
 * dependency and a per-frame budget in the middle of a session. The left-to-
 * right movement is rendered into a stereo file offline, and the device just
 * starts a file. Stereo is naturally stronger on headphones and still perfectly
 * usable on a speaker, so nothing is gated on headphones.
 */

export type SoundLayer = {
  /** Loops underneath the whole session. */
  bedUri: string | null;
  /** One-shot, plays over a phase boundary. Stereo, moves L → C → R → C → L. */
  sweepUri: string | null;
  /** One-shot, plays as the session ends. Centred, does not move. */
  resolveUri: string | null;
};

export const EMPTY_SOUND_LAYER: SoundLayer = {
  bedUri: null,
  sweepUri: null,
  resolveUri: null,
};

/**
 * Resolves the bundled assets, tolerating their absence.
 *
 * The generator writes into `assets/audio/sound-design/`, and those files are
 * committed — but a checkout that has not run it, or a test environment with no
 * asset transformer, must not crash. Anything that fails to resolve is simply
 * null, and the player treats a null layer as "no sound layer", which is the
 * voice-only session it already knew how to play.
 */
function resolveAssets(): SoundLayer {
  const load = (loader: () => unknown): string | null => {
    try {
      const asset = loader();
      if (typeof asset === 'string') return asset;
      if (typeof asset === 'number') return String(asset);
      const uri = (asset as { uri?: unknown } | null)?.uri;
      return typeof uri === 'string' ? uri : null;
    } catch {
      return null;
    }
  };

  return {
    bedUri: load(() => require('../../assets/audio/sound-design/nervous_ready_bed_v1.m4a')),
    sweepUri: load(() => require('../../assets/audio/sound-design/spatial_sweep_soft_v1.m4a')),
    resolveUri: load(() => require('../../assets/audio/sound-design/centre_resolve_soft_v1.m4a')),
  };
}

export const SOUND_LAYER: SoundLayer = resolveAssets();

/**
 * How many sweeps a session may contain, at most.
 *
 * Two. A movement that happens at every phase boundary stops being a
 * transition and becomes a tic — six of them in a twenty-minute session would
 * be noticed as a mannerism rather than felt as a shift.
 */
export const MAX_SWEEPS = 2;

/** Every cue index that opens a new recipe phase, after the first. */
function phaseBoundaries(timeline: Timeline): number[] {
  const boundaries: number[] = [];
  let previousPhase: string | null = null;

  timeline.cues.forEach((cue, index) => {
    if (index > 0 && cue.phase !== null && cue.phase !== previousPhase) {
      boundaries.push(index);
    }
    if (cue.phase !== null) previousPhase = cue.phase;
  });

  return boundaries;
}

/**
 * Where the spatial sweep plays.
 *
 * Sparingly, and only at phase boundaries — a phase changing is the moment the
 * session actually moves someone from one thing to another.
 *
 * Of the boundaries available, this takes **the first** (leaving `arrive`,
 * where the session proper begins) and **the middle one** (broadly the turn
 * from settling into preparing). Never the last: a sweep immediately before the
 * close would collide with the centred resolve, and movement followed at once
 * by stillness reads as a mistake rather than an ending.
 *
 * This is deliberately a rule of two lines rather than a sequencing engine.
 * Which boundaries are *right* is a sound-design judgement nobody has made; the
 * placement is an engineering default and is recorded as one.
 *
 * Pure and separate from the player, so where sweeps fall can be asserted
 * without audio, a device or a clock.
 */
export function sweepPointsFor(timeline: Timeline): number[] {
  const boundaries = phaseBoundaries(timeline);
  if (boundaries.length === 0) return [];
  if (boundaries.length <= MAX_SWEEPS) return boundaries;

  // Drop the final boundary so a sweep never runs into the closing resolve.
  const eligible = boundaries.slice(0, -1);
  const first = eligible[0];
  const middle = eligible[Math.floor(eligible.length / 2)];

  return first === middle ? [first] : [first, middle];
}

/**
 * How loud the sweep sits.
 *
 * An engineering default, like `BED_GAIN` in the player — not an approved
 * production value. The asset is already mastered 10 dB under the voice
 * reference; this attenuates it further so it reads as movement behind the
 * words rather than as an event in front of them.
 */
export const SWEEP_GAIN = 0.5;

/** As above, for the closing resolve. */
export const RESOLVE_GAIN = 0.45;
