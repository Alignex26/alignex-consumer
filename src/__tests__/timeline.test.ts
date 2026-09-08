import { buildTimeline, cueAt, edgeGain, nextCue } from '@/audio/timeline';
import { compose } from '@/lib/compose';
import { charactersFor, speechRequest } from '@/lib/voice/budget';
import type {
  InterventionModule,
  ManifestSegment,
  RecipePhase,
  SessionManifest,
  SpeechContext,
} from '@/types/session-engine';

/**
 * The playable timeline.
 *
 * Everything that can be wrong about a composition is arithmetic — a gap, an
 * overlap, a zero-length segment, a total that disagrees with its parts — and
 * arithmetic is testable without a device or an audio file. These are the bugs
 * that would otherwise present as "the audio drifts out of step with the
 * progress bar", which is close to undiagnosable from a bug report.
 */

const manifest = (segments: ManifestSegment[], durationSeconds?: number): SessionManifest => ({
  transitionKey: 'nervous_ready',
  durationSeconds: durationSeconds ?? segments
    .filter((s) => s.layer === 'foreground')
    .reduce((sum, s) => sum + s.durationSeconds, 0),
  recipeVersion: 1,
  dynamicSeconds: 0,
  segments,
});

const mod = (ordinal: number, offset: number, duration: number, phase = 'regulation'): ManifestSegment => ({
  kind: 'module',
  ordinal,
  layer: 'foreground',
  offsetSeconds: offset,
  durationSeconds: duration,
  moduleId: `m${ordinal}`,
  moduleKey: `key_m${ordinal}`,
  phase,
});

const silence = (ordinal: number, offset: number, duration: number): ManifestSegment => ({
  kind: 'silence',
  ordinal,
  layer: 'foreground',
  offsetSeconds: offset,
  durationSeconds: duration,
  phase: 'regulation',
});

describe('building a timeline', () => {
  it('lays cues out as absolute start and end times', () => {
    const result = buildTimeline(manifest([mod(0, 0, 60), silence(1, 60, 10), mod(2, 70, 30)]));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.timeline.cues.map((c) => [c.startsAt, c.endsAt])).toEqual([
      [0, 60],
      [60, 70],
      [70, 100],
    ]);
    expect(result.timeline.totalSeconds).toBe(100);
  });

  it('carries references, never URLs', () => {
    // Resolving to storage is the player's job, at one boundary.
    const result = buildTimeline(manifest([mod(0, 0, 60)]));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.timeline.cues[0].source).toEqual({
      kind: 'module',
      moduleId: 'm0',
      moduleKey: 'key_m0',
    });
  });

  it('separates the bed from the foreground sequence', () => {
    const bed: ManifestSegment = {
      kind: 'module',
      ordinal: 0,
      layer: 'bed',
      offsetSeconds: 0,
      durationSeconds: 90,
      moduleId: 'bed1',
      moduleKey: 'key_bed',
      phase: 'bed',
    };
    const result = buildTimeline(manifest([mod(0, 0, 60), mod(1, 60, 30), bed], 90));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.timeline.cues).toHaveLength(2);
    expect(result.timeline.bed?.moduleId).toBe('bed1');
  });
});

describe('a malformed manifest is refused, not played', () => {
  it('reports a gap distinctly from an overlap', () => {
    // Different causes, so they must not collapse into one vague error.
    const gap = buildTimeline(manifest([mod(0, 0, 60), mod(1, 70, 30)], 90));
    expect(gap.ok).toBe(false);
    if (gap.ok) throw new Error('unreachable');
    expect(gap.fault).toBe('gap');

    const overlap = buildTimeline(manifest([mod(0, 0, 60), mod(1, 50, 30)], 90));
    expect(overlap.ok).toBe(false);
    if (overlap.ok) throw new Error('unreachable');
    expect(overlap.fault).toBe('overlap');
  });

  it('refuses a segment of no length', () => {
    const result = buildTimeline(manifest([mod(0, 0, 60), mod(1, 60, 0)], 60));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.fault).toBe('bad_duration');
  });

  it('refuses a total that disagrees with its parts', () => {
    const result = buildTimeline(manifest([mod(0, 0, 60)], 600));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.fault).toBe('duration_mismatch');
  });

  it('refuses a duplicated ordinal and an empty manifest', () => {
    const dup = buildTimeline(manifest([mod(0, 0, 60), mod(0, 60, 30)], 90));
    expect(dup.ok).toBe(false);
    if (dup.ok) throw new Error('unreachable');
    expect(dup.fault).toBe('duplicate_ordinal');

    const empty = buildTimeline(manifest([], 0));
    expect(empty.ok).toBe(false);
    if (empty.ok) throw new Error('unreachable');
    expect(empty.fault).toBe('empty');
  });
});

describe('finding the cue at a moment', () => {
  const timeline = (() => {
    const r = buildTimeline(manifest([mod(0, 0, 60), silence(1, 60, 10), mod(2, 70, 30)]));
    if (!r.ok) throw new Error('unreachable');
    return r.timeline;
  })();

  it('locates the cue and the position inside it', () => {
    expect(cueAt(timeline, 0)).toMatchObject({ positionInCue: 0, cue: { index: 0 } });
    expect(cueAt(timeline, 65)).toMatchObject({ positionInCue: 5, cue: { index: 1 } });
    expect(cueAt(timeline, 99.5)).toMatchObject({ cue: { index: 2 } });
  });

  it('treats a boundary as the start of the next cue, never the end of the last', () => {
    // An off-by-one here replays the final instant of every segment.
    expect(cueAt(timeline, 60)?.cue.index).toBe(1);
    expect(cueAt(timeline, 70)?.cue.index).toBe(2);
  });

  it('returns nothing past the end or before the start', () => {
    expect(cueAt(timeline, 100)).toBeNull();
    expect(cueAt(timeline, 101)).toBeNull();
    expect(cueAt(timeline, -1)).toBeNull();
  });

  it('knows what to preload next, and when there is nothing', () => {
    expect(nextCue(timeline, 0)?.index).toBe(1);
    expect(nextCue(timeline, 2)).toBeNull();
  });
});

describe('edge fades', () => {
  it('is silent exactly at the joins and full in the middle', () => {
    expect(edgeGain(0, 60, 0.25)).toBe(0);
    expect(edgeGain(60, 60, 0.25)).toBe(0);
    expect(edgeGain(30, 60, 0.25)).toBe(1);
  });

  it('ramps up and back down within the cue, never outside it', () => {
    // Inside its own duration, so playback cannot finish early and drift out
    // of step with the composed timeline.
    expect(edgeGain(0.125, 60, 0.25)).toBeCloseTo(0.5);
    expect(edgeGain(59.875, 60, 0.25)).toBeCloseTo(0.5);
  });

  it('gives a very short cue one triangular ramp rather than two that collide', () => {
    const peak = edgeGain(0.1, 0.2, 0.25);
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(1);
    expect(edgeGain(0.2, 0.2, 0.25)).toBe(0);
  });

  it('never returns a value outside zero to one', () => {
    for (const p of [-5, 0, 0.01, 1, 30, 59.99, 60, 120]) {
      const gain = edgeGain(p, 60, 0.25);
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(1);
    }
  });
});

describe('what compose produces is always playable', () => {
  it('turns a composed manifest into a valid timeline', () => {
    // The join between the two halves of the engine. If composition and
    // playback ever disagree about contiguity, this is what catches it.
    const phases: RecipePhase[] = [
      { transitionKey: 'nervous_ready', ordinal: 0, phase: 'regulation', minSeconds: 60, maxSeconds: 180, isProvisional: true },
      { transitionKey: 'nervous_ready', ordinal: 1, phase: 'reframe', minSeconds: 60, maxSeconds: 180, isProvisional: true },
    ];
    const module_ = (id: string, duration: number): InterventionModule => ({
      id,
      moduleKey: `key_${id}`,
      family: 'regulation',
      techniqueKey: 't',
      storagePath: `modules/${id}.m4a`,
      durationSeconds: duration,
      intensity: 5,
      requiresHeadphones: false,
      isBed: false,
    });
    const context: SpeechContext = {
      slot: 'opening',
      transitionKey: 'nervous_ready',
      stateCurrent: 'nervous',
      stateTarget: 'ready',
      contextTag: 'presentation',
      intensity: 6,
    };

    for (const duration of [300, 600, 900, 1200]) {
      const composed = compose({
        transitionKey: 'nervous_ready',
        durationSeconds: duration,
        phases,
        modulesByPhase: {
          regulation: [module_('r1', 120)],
          reframe: [module_('c1', 120)],
        },
        bed: { ...module_('bed1', 60), family: 'bed', isBed: true },
        speech: [speechRequest(context, 'a'.repeat(charactersFor(20)))],
      });

      expect(composed.ok).toBe(true);
      if (!composed.ok) throw new Error('unreachable');

      const built = buildTimeline(composed.manifest);
      expect(built.ok).toBe(true);
      if (!built.ok) throw new Error(`${duration}s composed to an unplayable ${built.fault}`);
      expect(built.timeline.totalSeconds).toBe(composed.manifest.durationSeconds);
      expect(built.timeline.bed).not.toBeNull();
    }
  });
});
