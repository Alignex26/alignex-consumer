import { compose, type CompositionInput } from '@/lib/compose';
import {
  DynamicBudget,
  charactersFor,
  checkBudget,
  estimateSpeechSeconds,
  intensityBand,
  speechCacheKey,
  speechRequest,
} from '@/lib/voice/budget';
import type {
  InterventionModule,
  RecipePhase,
  SpeechContext,
} from '@/types/session-engine';

/**
 * The eight locked rules, as executable invariants.
 *
 * These exist because the expensive mistakes here are silent ones: a manifest
 * that quietly grows its spoken portion, a cache key that quietly starts
 * carrying user text, a composition that quietly becomes a whole stored
 * session. None of those break a screen, so nothing else would catch them.
 */

const module_ = (over: Partial<InterventionModule> & { id: string }): InterventionModule => ({
  moduleKey: `key_${over.id}`,
  family: 'regulation',
  techniqueKey: 'unspecified',
  storagePath: `modules/${over.id}.m4a`,
  durationSeconds: 120,
  intensity: 5,
  requiresHeadphones: false,
  isBed: false,
  ...over,
});

const phase = (ordinal: number, name: string, min: number, max: number): RecipePhase => ({
  transitionKey: 'nervous_ready',
  ordinal,
  phase: name,
  minSeconds: min,
  maxSeconds: max,
  isProvisional: true,
});

const PHASES = [phase(0, 'regulation', 60, 180), phase(1, 'reframe', 60, 180)];

const baseInput = (over: Partial<CompositionInput> = {}): CompositionInput => ({
  transitionKey: 'nervous_ready',
  durationSeconds: 600,
  phases: PHASES,
  modulesByPhase: {
    regulation: [module_({ id: 'r1', durationSeconds: 150 })],
    reframe: [module_({ id: 'c1', durationSeconds: 150, family: 'cognitive' })],
  },
  ...over,
});

const context = (over: Partial<SpeechContext> = {}): SpeechContext => ({
  slot: 'opening',
  transitionKey: 'nervous_ready',
  stateCurrent: 'nervous',
  stateTarget: 'ready',
  contextTag: 'presentation',
  intensity: 6,
  ...over,
});

describe('Rule 4 — the dynamic speech budget', () => {
  it('rejects a session over the ceiling rather than trimming it', () => {
    // A silent trim would keep the session playable and hide the drift the
    // ceiling exists to catch, so over-budget must fail the whole composition.
    const tooLong = 'a'.repeat(charactersFor(DynamicBudget.ceilingSeconds) + 100);
    const result = compose(
      baseInput({ speech: [speechRequest(context(), tooLong)] })
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('budget_exceeded');
  });

  it('flags an over-normal but within-ceiling session as exceptional', () => {
    // Allowed by the locked direction, but reported — otherwise "exceptional"
    // quietly becomes the average, which is how the cost escapes.
    const text = 'a'.repeat(charactersFor(38));
    const verdict = checkBudget([speechRequest(context(), text)]);

    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error('unreachable');
    expect(verdict.exceptional).toBe(true);
  });

  it('treats a normal session as unexceptional', () => {
    const text = 'a'.repeat(charactersFor(20));
    const verdict = checkBudget([speechRequest(context(), text)]);

    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error('unreachable');
    expect(verdict.exceptional).toBe(false);
  });

  it('costs an opening and a close together, not separately', () => {
    // The worked example in the locked document is 20s + 20s = 40s, which is
    // over the 30s normal. Pinned so the budget is unambiguously per session.
    const twenty = 'a'.repeat(charactersFor(20));
    const verdict = checkBudget([
      speechRequest(context({ slot: 'opening' }), twenty),
      speechRequest(context({ slot: 'closing' }), twenty),
    ]);

    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error('unreachable');
    expect(Math.round(verdict.totalSeconds)).toBe(40);
    expect(verdict.exceptional).toBe(true);
  });

  it('estimates seconds from characters consistently in both directions', () => {
    expect(estimateSpeechSeconds('a'.repeat(charactersFor(30)))).toBeCloseTo(30, 1);
  });
});

describe('S3 — no raw user text reaches speech or a cache key', () => {
  it('refuses a context tag that is not a closed short token', () => {
    // The one field that is not from a closed vocabulary, and therefore the
    // only place free text could leak into a shared cache key.
    expect(() =>
      speechCacheKey(context({ contextTag: 'Work was intense and I can’t switch off' }))
    ).toThrow(/Unsafe context tag/);
  });

  it('fails closed rather than sanitising the tag into something usable', () => {
    expect(() => speechCacheKey(context({ contextTag: 'PRESENTATION' }))).toThrow();
    expect(() => speechCacheKey(context({ contextTag: 'a'.repeat(64) }))).toThrow();
  });

  it('derives a key from structured state alone', () => {
    const key = speechCacheKey(context());

    expect(key).toBe('opening:nervous_ready:nervous:ready:presentation:medium');
  });

  it('gives two people in the same structured situation the same key', () => {
    // This is what makes the situation cache shareable: the key contains
    // nothing either person wrote, so one generation serves both.
    expect(speechCacheKey(context({ intensity: 5 }))).toBe(
      speechCacheKey(context({ intensity: 7 }))
    );
  });

  it('bands intensity so the cache can actually hit', () => {
    expect(intensityBand(2)).toBe('low');
    expect(intensityBand(5)).toBe('medium');
    expect(intensityBand(9)).toBe('high');
  });
});

describe('Rule 2 — sessions are composed, never stored whole', () => {
  it('produces references, with no path to a rendered session', () => {
    const result = compose(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.manifest.segments.length).toBeGreaterThan(1);
    expect(Object.keys(result.manifest)).not.toContain('storagePath');
  });

  it('serves different durations from one recipe without new recordings', () => {
    // P4: duration is a runtime parameter, not the identity of the
    // intervention. The same modules answer both requests.
    const short = compose(baseInput({ durationSeconds: 300 }));
    const long = compose(baseInput({ durationSeconds: 900 }));

    expect(short.ok).toBe(true);
    expect(long.ok).toBe(true);
    if (!short.ok || !long.ok) throw new Error('unreachable');
    expect(long.manifest.durationSeconds).toBeGreaterThan(short.manifest.durationSeconds);

    const moduleKeys = (m: typeof short.manifest) =>
      m.segments.filter((s) => s.kind === 'module').map((s) => s.moduleKey);
    expect(moduleKeys(long.manifest)).toEqual(moduleKeys(short.manifest));
  });

  it('reports the duration it actually composed, not the one requested', () => {
    const result = compose(baseInput({ durationSeconds: 100_000 }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.manifest.durationSeconds).toBeLessThan(100_000);
  });
});

describe('Rule 8 — personalisation is effectiveness data', () => {
  it('prefers the module this person has rated well', () => {
    const good = module_({ id: 'good', durationSeconds: 150 });
    const bad = module_({ id: 'bad', durationSeconds: 150 });

    const result = compose(
      baseInput({
        modulesByPhase: { regulation: [bad, good], reframe: [module_({ id: 'c1' })] },
        effectiveness: [
          { moduleId: 'good', positive: 5, total: 5 },
          { moduleId: 'bad', positive: 0, total: 5 },
        ],
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const chosen = result.manifest.segments.find(
      (s) => s.kind === 'module' && s.phase === 'regulation'
    );
    expect(chosen && chosen.kind === 'module' && chosen.moduleId).toBe('good');
  });

  it('ignores a rating too small to mean anything', () => {
    // One good session should not decide a module's fate for ever.
    const barely = module_({ id: 'barely', durationSeconds: 150 });
    const other = module_({ id: 'aaa_other', durationSeconds: 150 });

    const result = compose(
      baseInput({
        modulesByPhase: { regulation: [barely, other], reframe: [module_({ id: 'c1' })] },
        effectiveness: [{ moduleId: 'barely', positive: 1, total: 1 }],
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const chosen = result.manifest.segments.find(
      (s) => s.kind === 'module' && s.phase === 'regulation'
    );
    // Both sit at neutral, so the deterministic tie-break decides, not the
    // single rating.
    expect(chosen && chosen.kind === 'module' && chosen.moduleId).toBe('aaa_other');
  });

  it('composes the same manifest twice from the same inputs', () => {
    expect(compose(baseInput())).toEqual(compose(baseInput()));
  });

  it('works for someone signed out, with no history at all', () => {
    const result = compose(baseInput({ effectiveness: undefined }));

    expect(result.ok).toBe(true);
  });
});

describe('profitability guardrails hold structurally', () => {
  it('speaks nothing at all unless speech was explicitly supplied', () => {
    // "Unrestricted dynamic narration impossible by default". The engine has
    // no path that invents narration: with no speech passed in, a session is
    // composed entirely from reusable content and bills nothing.
    const result = compose(baseInput({ speech: undefined }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.manifest.dynamicSeconds).toBe(0);
    expect(result.manifest.segments.filter((s) => s.kind === 'generated')).toHaveLength(0);
  });

  it('emits only the speech it was given, never more', () => {
    const result = compose(
      baseInput({ speech: [speechRequest(context({ slot: 'opening' }), 'a'.repeat(charactersFor(10)))] })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const generated = result.manifest.segments.filter((s) => s.kind === 'generated');
    expect(generated).toHaveLength(1);
  });

  it('fills the session from the library, so reuse is the default', () => {
    const result = compose(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const kinds = result.manifest.segments.map((s) => s.kind);
    expect(kinds).toContain('module');
    expect(kinds).not.toContain('generated');
  });

  it('refuses the whole composition when over budget, leaving nothing to play', () => {
    // No partial manifest, so there is no way to "just play the bit that fit"
    // and quietly lose the budget error.
    const tooLong = 'a'.repeat(charactersFor(DynamicBudget.ceilingSeconds) + 1000);
    const result = compose(baseInput({ speech: [speechRequest(context(), tooLong)] }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result).not.toHaveProperty('manifest');
  });
});

describe('composition failures are typed, not thrown', () => {
  it('reports an empty library rather than producing a broken session', () => {
    // The expected state until audio content lands. It must fail cleanly.
    const result = compose(baseInput({ modulesByPhase: {} }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('library_empty');
  });

  it('reports a transition with no phase structure', () => {
    const result = compose(baseInput({ phases: [] }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('no_recipe');
  });

  it('reports a duration that cannot satisfy the recipe floors', () => {
    const result = compose(baseInput({ durationSeconds: 30 }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('duration_unreachable');
  });

  it('reports a phase no module is short enough to fill', () => {
    const result = compose(
      baseInput({
        durationSeconds: 130,
        modulesByPhase: {
          regulation: [module_({ id: 'r1', durationSeconds: 600 })],
          reframe: [module_({ id: 'c1', durationSeconds: 600 })],
        },
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('phase_unfilled');
  });
});

describe('the manifest is playable as a timeline', () => {
  it('lays foreground segments end to end with no gap or overlap', () => {
    const result = compose(
      baseInput({ speech: [speechRequest(context(), 'a'.repeat(charactersFor(20)))] })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const foreground = result.manifest.segments
      .filter((s) => s.layer === 'foreground')
      .sort((a, b) => a.ordinal - b.ordinal);

    let cursor = 0;
    for (const segment of foreground) {
      expect(segment.offsetSeconds).toBe(cursor);
      cursor += segment.durationSeconds;
    }
    expect(cursor).toBe(result.manifest.durationSeconds);
  });

  it('runs the bed underneath as a concurrent layer for the whole session', () => {
    const bed = module_({ id: 'bed1', family: 'bed', isBed: true, durationSeconds: 60 });
    const result = compose(baseInput({ bed }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const beds = result.manifest.segments.filter((s) => s.layer === 'bed');
    expect(beds).toHaveLength(1);
    expect(beds[0].offsetSeconds).toBe(0);
    expect(beds[0].durationSeconds).toBe(result.manifest.durationSeconds);
  });

  it('attributes every silence to the phase it belongs to', () => {
    const result = compose(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    for (const segment of result.manifest.segments) {
      if (segment.kind === 'silence') expect(segment.phase).not.toBe('');
    }
  });

  it('records the spoken seconds on the manifest for auditing', () => {
    const result = compose(
      baseInput({ speech: [speechRequest(context(), 'a'.repeat(charactersFor(25)))] })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.manifest.dynamicSeconds).toBe(25);
  });
});
