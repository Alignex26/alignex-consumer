import type { SessionManifest, SpeechSlot } from '@/types/session-engine';

/**
 * A manifest, turned into a playable timeline.
 *
 * Deliberately pure and separate from the player. Everything that can be wrong
 * about a composition — an overlap, a gap, a segment of no length, a total that
 * disagrees with its parts — is arithmetic, and arithmetic can be tested
 * without a device, an audio file or a clock. What is left in the hook is
 * genuinely just driving `expo-audio`.
 *
 * The timeline carries REFERENCES, not URLs. Resolving a module or a cached
 * speech segment to a URL is the player's job and happens once, at the
 * boundary, so the storage convention lives in a single place.
 */

/** What a cue plays. `silence` plays nothing and is composed, never a file. */
export type CueSource =
  | { kind: 'module'; moduleId: string; moduleKey: string }
  | { kind: 'generated'; cacheKey: string; slot: SpeechSlot }
  | { kind: 'silence' };

export type TimelineCue = {
  /** Position in the foreground sequence, from zero. */
  index: number;
  ordinal: number;
  source: CueSource;
  /** Absolute seconds from the start of the session. */
  startsAt: number;
  endsAt: number;
  durationSeconds: number;
  /** Which recipe phase this belongs to, where it has one. */
  phase: string | null;
};

export type TimelineBed = {
  moduleId: string;
  moduleKey: string;
  durationSeconds: number;
};

export type Timeline = {
  cues: TimelineCue[];
  /** Plays underneath everything, looped. Null when the recipe has no bed. */
  bed: TimelineBed | null;
  totalSeconds: number;
};

export type TimelineFault =
  | 'empty'
  | 'gap'
  | 'overlap'
  | 'bad_duration'
  | 'duplicate_ordinal'
  | 'duration_mismatch'
  | 'multiple_beds';

export type TimelineResult =
  | { ok: true; timeline: Timeline }
  | { ok: false; fault: TimelineFault; detail: string };

function fault(f: TimelineFault, detail: string): TimelineResult {
  return { ok: false, fault: f, detail };
}

/**
 * Builds and validates the timeline.
 *
 * `compose` already produces contiguous segments, but a manifest can also
 * arrive from the database, where it has been through two serialisations and a
 * schema. A malformed one must be caught here: an overlap or a gap would
 * otherwise present as audio that drifts out of time with the progress bar,
 * which is close to impossible to diagnose from a bug report.
 */
export function buildTimeline(manifest: SessionManifest): TimelineResult {
  const foreground = manifest.segments
    .filter((s) => s.layer === 'foreground')
    .sort((a, b) => a.ordinal - b.ordinal);

  if (foreground.length === 0) {
    return fault('empty', 'The manifest has no foreground segments.');
  }

  const bedSegments = manifest.segments.filter((s) => s.layer === 'bed');
  if (bedSegments.length > 1) {
    return fault('multiple_beds', `Expected at most one bed, found ${bedSegments.length}.`);
  }

  const seen = new Set<number>();
  const cues: TimelineCue[] = [];
  let cursor = 0;

  for (let i = 0; i < foreground.length; i += 1) {
    const segment = foreground[i];

    if (seen.has(segment.ordinal)) {
      return fault('duplicate_ordinal', `Ordinal ${segment.ordinal} appears more than once.`);
    }
    seen.add(segment.ordinal);

    if (!Number.isFinite(segment.durationSeconds) || segment.durationSeconds <= 0) {
      return fault(
        'bad_duration',
        `Segment at ordinal ${segment.ordinal} has duration ${segment.durationSeconds}.`
      );
    }

    // Contiguity. Reported as gap or overlap rather than as one vague error,
    // because the two have completely different causes.
    if (segment.offsetSeconds > cursor) {
      return fault(
        'gap',
        `Silence of ${segment.offsetSeconds - cursor}s before ordinal ${segment.ordinal} that no segment accounts for.`
      );
    }
    if (segment.offsetSeconds < cursor) {
      return fault(
        'overlap',
        `Ordinal ${segment.ordinal} starts ${cursor - segment.offsetSeconds}s before the previous segment ends.`
      );
    }

    let source: CueSource;
    if (segment.kind === 'module') {
      source = { kind: 'module', moduleId: segment.moduleId, moduleKey: segment.moduleKey };
    } else if (segment.kind === 'generated') {
      source = {
        kind: 'generated',
        cacheKey: segment.speech.cacheKey,
        slot: segment.speech.slot,
      };
    } else {
      source = { kind: 'silence' };
    }

    cues.push({
      index: i,
      ordinal: segment.ordinal,
      source,
      startsAt: cursor,
      endsAt: cursor + segment.durationSeconds,
      durationSeconds: segment.durationSeconds,
      phase: segment.kind === 'generated' ? null : segment.phase,
    });

    cursor += segment.durationSeconds;
  }

  if (cursor !== manifest.durationSeconds) {
    return fault(
      'duration_mismatch',
      `Segments total ${cursor}s but the manifest says ${manifest.durationSeconds}s.`
    );
  }

  const bedSegment = bedSegments[0];
  const bed =
    bedSegment && bedSegment.kind === 'module'
      ? {
          moduleId: bedSegment.moduleId,
          moduleKey: bedSegment.moduleKey,
          durationSeconds: bedSegment.durationSeconds,
        }
      : null;

  return { ok: true, timeline: { cues, bed, totalSeconds: cursor } };
}

/** The cue playing at this moment, and how far into it we are. */
export function cueAt(
  timeline: Timeline,
  elapsedSeconds: number
): { cue: TimelineCue; positionInCue: number } | null {
  if (elapsedSeconds < 0 || elapsedSeconds >= timeline.totalSeconds) return null;

  for (const cue of timeline.cues) {
    if (elapsedSeconds < cue.endsAt) {
      return { cue, positionInCue: elapsedSeconds - cue.startsAt };
    }
  }

  return null;
}

/** The cue after this one, for preloading. Null at the end. */
export function nextCue(timeline: Timeline, index: number): TimelineCue | null {
  return timeline.cues[index + 1] ?? null;
}

/**
 * A short volume ramp at each cue's edges.
 *
 * Concatenated audio clicks at the joins when a waveform is cut mid-cycle, and
 * a click is exactly the wrong sound in a regulation session. This ramps in and
 * out INSIDE each cue's own duration rather than overlapping neighbouring cues.
 *
 * That is a deliberate choice against a true crossfade: overlapping cues would
 * make real playback finish earlier than the composed duration, so the audio
 * would drift out of step with the progress bar and with `dynamicSeconds`.
 * Keeping the timeline authoritative is worth more than a smoother join. If a
 * real crossfade is wanted, composition has to model the overlap — that is a
 * manifest change, not a player change.
 *
 * Returns a multiplier in 0..1. Pure, so the ramp is testable without audio.
 */
export function edgeGain(
  positionInCue: number,
  cueDuration: number,
  fadeSeconds: number
): number {
  if (cueDuration <= 0) return 0;
  if (positionInCue <= 0) return 0;
  if (positionInCue >= cueDuration) return 0;

  // A cue too short for two ramps gets a single triangular one rather than a
  // fade-in that is still rising when the fade-out starts.
  const fade = Math.min(fadeSeconds, cueDuration / 2);
  if (fade <= 0) return 1;

  const rising = positionInCue / fade;
  const falling = (cueDuration - positionInCue) / fade;

  return Math.max(0, Math.min(1, rising, falling));
}
