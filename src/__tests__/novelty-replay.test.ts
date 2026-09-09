/// <reference types="node" />

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { compose } from '../../supabase/functions/_shared/compose';
import {
  applyRecency,
  DEFAULT_NOVELTY,
  fingerprintModules,
  isRecentlySeen,
  manifestFingerprint,
} from '../../supabase/functions/_shared/novelty';
import {
  rebuildExact,
  reuseIntent,
  type SavedModuleVersion,
  type SavedSession,
} from '../../supabase/functions/_shared/replay';
import type { ManifestSegment } from '../../supabase/functions/_shared/types';

import { composeFor, DURATIONS, LIBRARY, modulesByPhaseFor, RECIPES } from './composition-proof.test';

/**
 * "Fresh by default. Repeat on purpose."
 *
 * The two behaviours that look alike and must not share a path: accidental
 * repetition, which the composer should avoid, and intentional replay, which
 * it must honour.
 */

const moduleSegments = (segments: ManifestSegment[]) =>
  segments.filter((s): s is Extract<ManifestSegment, { kind: 'module' }> => s.kind === 'module');

describe('manifest fingerprints', () => {
  const composed = composeFor('nervous_ready', 600);
  if (!composed.ok) throw new Error('fixture failed');

  it('is stable for the same composition', () => {
    expect(manifestFingerprint(composed.manifest)).toBe(manifestFingerprint(composed.manifest));
  });

  it('ignores signed URLs entirely', () => {
    // The failure this prevents: signed URLs expire in two hours and differ on
    // every request. If they fed the fingerprint, every session would look
    // unique and the freshness check would be inert while appearing to work.
    const resigned = {
      ...composed.manifest,
      segments: composed.manifest.segments.map((s) =>
        s.kind === 'module' ? { ...s, storagePath: `https://signed/${Math.random()}` } : s
      ),
    };
    expect(manifestFingerprint(resigned)).toBe(manifestFingerprint(composed.manifest));
  });

  it('ignores silence and duration', () => {
    // The same modules in the same order at two lengths are the same
    // experience. Treating them as distinct would let the composer repeat
    // itself simply by varying the length.
    const padded = {
      ...composed.manifest,
      durationSeconds: composed.manifest.durationSeconds + 120,
      segments: [
        ...composed.manifest.segments,
        { kind: 'silence', ordinal: 99, layer: 'foreground', offsetSeconds: 0, durationSeconds: 120, phase: 'x' } as ManifestSegment,
      ],
    };
    expect(manifestFingerprint(padded)).toBe(manifestFingerprint(composed.manifest));
  });

  it('changes when a module is replaced or its version moves', () => {
    const other = composeFor('wound_up_home', 600);
    if (!other.ok) throw new Error('unreachable');
    expect(manifestFingerprint(other.manifest)).not.toBe(manifestFingerprint(composed.manifest));

    const ids = moduleSegments(composed.manifest.segments).map((s) => s.moduleId);
    const bumped = new Map([[ids[0], 2]]);
    expect(manifestFingerprint(composed.manifest, bumped))
      .not.toBe(manifestFingerprint(composed.manifest));
  });

  it('carries the module identities in order', () => {
    const ids = moduleSegments(composed.manifest.segments)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((s) => `${s.moduleId}@1`);
    expect(fingerprintModules(manifestFingerprint(composed.manifest))).toEqual(ids);
  });
});

describe('recency shapes ranking without banning anything', () => {
  it('penalises a recently heard module', () => {
    const scores = new Map([['a', 0.9], ['b', 0.9]]);
    const adjusted = applyRecency(scores, [['a']]);

    expect(adjusted.get('a')!).toBeLessThan(adjusted.get('b')!);
  });

  it('decays: the further back, the smaller the penalty', () => {
    const scores = new Map([['a', 0.9], ['b', 0.9]]);
    const adjusted = applyRecency(scores, [['b'], ['a']]);

    // `b` was heard more recently than `a`, so it is penalised harder.
    expect(adjusted.get('b')!).toBeLessThan(adjusted.get('a')!);
  });

  it('never bans a module, however often it was heard', () => {
    // Rule 8 says the person hears what works for them. A freshness mechanism
    // that could bury the single most effective module would be trading
    // effectiveness for variety without anyone deciding to.
    const scores = new Map([['a', 1]]);
    const heard = Array.from({ length: 20 }, () => ['a']);
    const adjusted = applyRecency(scores, heard);

    expect(adjusted.get('a')!).toBeGreaterThanOrEqual(DEFAULT_NOVELTY.penaltyFloor);
  });

  it('cannot outweigh a real effectiveness difference', () => {
    // The penalty is bounded below the gap between a proven and an unrated
    // module, so novelty reorders equals rather than overriding evidence.
    const scores = new Map([['proven', 1.0], ['unrated', 0.5]]);
    const adjusted = applyRecency(scores, [['proven'], ['proven'], ['proven']]);

    expect(adjusted.get('proven')!).toBeGreaterThan(adjusted.get('unrated') ?? 0.5);
  });

  it('only looks back as far as the policy says', () => {
    const scores = new Map([['a', 0.9]]);
    const old = Array.from({ length: 10 }, (_, i) => (i === 9 ? ['a'] : ['z']));
    const adjusted = applyRecency(scores, old, { ...DEFAULT_NOVELTY, lookbackSessions: 3 });

    expect(adjusted.get('a')).toBe(0.9);
  });

  it('recognises a session it has just served', () => {
    const composed = composeFor('flat_go', 900);
    if (!composed.ok) throw new Error('unreachable');
    const fp = manifestFingerprint(composed.manifest);

    expect(isRecentlySeen(fp, [fp])).toBe(true);
    expect(isRecentlySeen(fp, ['something-else'])).toBe(false);
  });
});

describe('exact replay', () => {
  const saved: SavedSession = {
    id: 's1', userId: 'u1', manifestId: 'm1',
    transitionKey: 'nervous_ready', durationSeconds: 600,
    fingerprint: 'nervous_ready|x@1', moduleVersionIds: ['v1', 'v2'],
  };

  const version = (over: Partial<SavedModuleVersion> & { moduleVersionId: string }): SavedModuleVersion => ({
    moduleId: `mod_${over.moduleVersionId}`,
    moduleKey: `key_${over.moduleVersionId}`,
    version: 1,
    storagePath: `modules/orient/${over.moduleVersionId}.m4a`,
    durationSeconds: 40,
    withdrawnAt: null,
    moduleApproved: true,
    moduleActive: true,
    ...over,
  });

  const segments: ManifestSegment[] = [
    { kind: 'module', ordinal: 0, layer: 'foreground', offsetSeconds: 0, durationSeconds: 40, moduleId: 'old', moduleKey: 'old', storagePath: 'modules/orient/old.m4a', phase: 'arrive' },
    { kind: 'silence', ordinal: 1, layer: 'foreground', offsetSeconds: 40, durationSeconds: 10, phase: 'arrive' },
    { kind: 'module', ordinal: 2, layer: 'foreground', offsetSeconds: 50, durationSeconds: 40, moduleId: 'old2', moduleKey: 'old2', storagePath: 'modules/orient/old2.m4a', phase: 'close' },
  ];

  it('reproduces the saved module versions, not the current ones', () => {
    const result = rebuildExact(saved, [version({ moduleVersionId: 'v1' }), version({ moduleVersionId: 'v2' })], segments);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const played = moduleSegments(result.manifest.segments).map((s) => s.storagePath);
    expect(played).toEqual(['modules/orient/v1.m4a', 'modules/orient/v2.m4a']);
  });

  it('preserves order and the composed silence', () => {
    const result = rebuildExact(saved, [version({ moduleVersionId: 'v1' }), version({ moduleVersionId: 'v2' })], segments);
    if (!result.ok) throw new Error('unreachable');
    expect(result.manifest.segments.map((s) => s.kind)).toEqual(['module', 'silence', 'module']);
  });

  it('stores no signed URL — the caller signs afresh', () => {
    const result = rebuildExact(saved, [version({ moduleVersionId: 'v1' }), version({ moduleVersionId: 'v2' })], segments);
    if (!result.ok) throw new Error('unreachable');
    for (const s of moduleSegments(result.manifest.segments)) {
      expect(s.storagePath).not.toMatch(/^https?:/);
      expect(s.storagePath).toMatch(/^modules\//);
    }
  });

  it('fails explicitly when a saved version is withdrawn', () => {
    // Never substitutes another module and calls the result exact. That would
    // be a quiet lie about the one thing the feature promises.
    const result = rebuildExact(saved, [
      version({ moduleVersionId: 'v1', withdrawnAt: '2026-01-01T00:00:00Z' }),
      version({ moduleVersionId: 'v2' }),
    ], segments);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('content_withdrawn');
    expect(result.withdrawn).toContain('key_v1');
  });

  it('fails when the module behind a saved version is de-approved', () => {
    // Intentional replay overrides novelty. It never overrides the clinical gate.
    const result = rebuildExact(saved, [
      version({ moduleVersionId: 'v1', moduleApproved: false }),
      version({ moduleVersionId: 'v2' }),
    ], segments);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('content_withdrawn');
  });

  it('fails when a saved version no longer exists', () => {
    const result = rebuildExact(saved, [version({ moduleVersionId: 'v1' })], segments);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('content_missing');
  });
});

describe('reuse this', () => {
  it('carries only the intent, so the composer works normally', () => {
    const saved: SavedSession = {
      id: 's1', userId: 'u1', manifestId: 'm1',
      transitionKey: 'wound_up_home', durationSeconds: 900,
      fingerprint: 'x', moduleVersionIds: ['v1'],
    };

    expect(reuseIntent(saved)).toEqual({
      transitionKey: 'wound_up_home',
      durationSeconds: 900,
    });
  });

  it('produces a valid fresh composition even when the original content is gone', () => {
    // The difference from exact replay: withdrawn content is replaced rather
    // than fatal, because the person asked for the shape, not the copy.
    const intent = reuseIntent({
      id: 's', userId: 'u', manifestId: 'm',
      transitionKey: 'wound_up_home', durationSeconds: 900,
      fingerprint: 'x', moduleVersionIds: ['gone'],
    });

    const result = compose({
      transitionKey: intent.transitionKey,
      durationSeconds: intent.durationSeconds,
      phases: [],
      modulesByPhase: {},
    });
    // No phases supplied here, so it fails cleanly rather than inventing one.
    expect(result.ok).toBe(false);

    const real = composeFor(intent.transitionKey, intent.durationSeconds);
    expect(real.ok).toBe(true);
  });
});

describe('the replay machinery stays server-side', () => {
  it('is never imported at runtime by the client', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []
      );

    for (const file of walk(join(__dirname, '..')).filter((f) => !f.includes('__tests__'))) {
      const text = readFileSync(file, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        if (!/_shared\/(novelty|replay)/.test(line)) continue;
        expect(/^\s*(import|export)\s+type\b/.test(line)).toBe(true);
      }
    }
  });

  it('keeps saved sessions to their owner', () => {
    const sql = readFileSync(
      join(__dirname, '..', '..', 'supabase', 'migrations', '20260909160000_novelty_and_saved_sessions.sql'),
      'utf8'
    );
    expect(sql).toContain('alter table saved_sessions                enable row level security;');
    for (const policy of ['own_select', 'own_insert', 'own_update']) {
      expect(sql).toContain(`saved_sessions_${policy}`);
    }
    expect(sql).toContain('auth.uid() = user_id');
    // Library metadata stays service-role only, like every other content table.
    expect(sql).toContain('alter table intervention_module_versions  enable row level security;');
    expect(sql).not.toMatch(/create policy[^;]*on intervention_module_versions/);
  });
});

describe('the within-session rule still holds', () => {
  it('never repeats a module in any of the twenty cases', () => {
    for (const recipe of RECIPES) {
      for (const seconds of DURATIONS) {
        const result = composeFor(recipe, seconds);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('unreachable');
        const ids = moduleSegments(result.manifest.segments).map((s) => s.moduleId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('still fails explicitly when unique inventory runs out', () => {
    const result = compose({
      transitionKey: 'nervous_ready',
      durationSeconds: 300,
      phases: [
        { transitionKey: 'nervous_ready', ordinal: 0, phase: 'arrive', minSeconds: 20, maxSeconds: 60, isProvisional: true },
        { transitionKey: 'nervous_ready', ordinal: 1, phase: 'close', minSeconds: 15, maxSeconds: 45, isProvisional: true },
      ],
      modulesByPhase: {
        arrive: LIBRARY.filter((m) => m.family === 'orient' && m.durationSeconds === 20),
        close: [],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('phase_unfilled');
  });

  it('composes with recency applied without breaking eligibility', () => {
    // Novelty reorders candidates; it must not make a valid recipe unfillable.
    const byPhase = modulesByPhaseFor('scattered_focused');
    const everything = Object.values(byPhase).flat().map((m) => m.id);
    const scores = applyRecency(new Map(), [everything, everything, everything]);

    const result = compose({
      transitionKey: 'scattered_focused',
      durationSeconds: 600,
      phases: [
        { transitionKey: 'scattered_focused', ordinal: 0, phase: 'arrive', minSeconds: 20, maxSeconds: 60, isProvisional: true },
      ],
      modulesByPhase: { arrive: byPhase.arrive },
      effectiveness: [...scores.entries()].map(([moduleId, rate]) => ({
        moduleId, positive: Math.round(rate * 10), total: 10,
      })),
    });

    expect(result.ok).toBe(true);
  });
});
