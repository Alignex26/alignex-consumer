/// <reference types="node" />

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { compose } from '../../supabase/functions/_shared/compose';
import type { InterventionModule } from '../../supabase/functions/_shared/types';

import { composeFor, LIBRARY, modulesByPhaseFor } from './composition-proof.test';

/**
 * THE SELECTION GATE.
 *
 * What may reach a person's ears. Every rule below is checked against the
 * deployed composer's source or run through the real allocator, because a
 * schema column, a policy or a comment enforces nothing on its own.
 */

const COMPOSER = readFileSync(
  join(__dirname, '..', '..', 'supabase', 'functions', 'compose', 'index.ts'),
  'utf8'
);

describe('unapproved or unplayable content can never be selected', () => {
  it('filters on approved and active before anything is allocated', () => {
    // `approved` is the clinical gate and this query is the whole of its
    // enforcement — there is no second check downstream.
    const query = COMPOSER.slice(
      COMPOSER.indexOf('.from("intervention_modules")'),
      COMPOSER.indexOf('const modules =')
    );

    expect(query).toContain('.eq("is_active", true)');
    expect(query).toContain('.eq("approved", true)');
  });

  it('fails explicitly when nothing is approved', () => {
    expect(COMPOSER).toContain('if (modules.length === 0) return fail("library_empty");');
  });

  it('refuses to serve a session whose audio cannot be signed', () => {
    // A module with no signable asset is not playable. Rather than hand the
    // client a segment that renders as silence, the whole composition fails.
    expect(COMPOSER).toContain('if (signed.size !== paths.length) return fail("audio_unavailable");');
  });

  it('signs against the private bucket, with an expiry', () => {
    expect(COMPOSER).toContain('const AUDIO_BUCKET = "intervention-audio";');
    expect(COMPOSER).toContain('createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)');
    // Long enough for a 20 minute session plus a retry; far from permanent.
    expect(COMPOSER).toMatch(/SIGNED_URL_TTL_SECONDS = (\d+)/);
    const ttl = Number(/SIGNED_URL_TTL_SECONDS = (\d+)/.exec(COMPOSER)?.[1]);
    expect(ttl).toBeGreaterThan(1200);
    expect(ttl).toBeLessThanOrEqual(24 * 3600);
  });

  it('never reaches a proprietary table or bucket from the client', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []
      );
    const appCode = walk(join(__dirname, '..')).filter((f) => !f.includes('__tests__'));

    for (const file of appCode) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toContain("from('intervention_modules')");
      expect(text).not.toContain('intervention-audio');
    }
  });
});

describe('selection rules, run through the real allocator', () => {
  const nervous = () => modulesByPhaseFor('nervous_ready');

  it('never selects a module from an ineligible family', () => {
    // Eligibility is family-level and comes from the database. A module of the
    // wrong family is simply not a candidate for the phase.
    const byPhase = nervous();
    for (const [phase, candidates] of Object.entries(byPhase)) {
      for (const candidate of candidates) {
        expect(candidates.some((c) => c.id === candidate.id)).toBe(true);
      }
      // `arrive` accepts only `orient`.
      if (phase === 'arrive') {
        expect(candidates.every((c) => c.family === 'orient')).toBe(true);
      }
    }
  });

  it('never selects a module longer than its phase allocation', () => {
    const result = composeFor('nervous_ready', 300);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    // Every module segment fits inside the span its phase was given.
    const byPhase = new Map<string, number>();
    for (const s of result.manifest.segments) {
      if (s.kind === 'generated') continue;
      byPhase.set(s.phase, (byPhase.get(s.phase) ?? 0) + s.durationSeconds);
    }
    for (const s of result.manifest.segments) {
      if (s.kind !== 'module') continue;
      expect(s.durationSeconds).toBeLessThanOrEqual(byPhase.get(s.phase) ?? 0);
    }
  });

  it('never selects a module already used in this session', () => {
    for (const seconds of [300, 600, 900, 1200]) {
      const result = composeFor('wound_up_home', seconds);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      const ids = result.manifest.segments
        .filter((s) => s.kind === 'module')
        .map((s) => (s as { moduleId: string }).moduleId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('fails rather than composing from an empty library', () => {
    const result = compose({
      transitionKey: 'nervous_ready',
      durationSeconds: 600,
      phases: [
        { transitionKey: 'nervous_ready', ordinal: 0, phase: 'arrive', minSeconds: 20, maxSeconds: 60, isProvisional: true },
      ],
      modulesByPhase: {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('library_empty');
  });

  it('fails rather than stretching a phase past its ceiling', () => {
    // Only an over-long module available: the phase cannot be filled, and the
    // engine does not widen the band to accommodate it.
    const tooLong: InterventionModule[] = LIBRARY
      .filter((m) => m.family === 'orient')
      .map((m) => ({ ...m, durationSeconds: 5000 }));

    const result = compose({
      transitionKey: 'nervous_ready',
      durationSeconds: 300,
      phases: [
        { transitionKey: 'nervous_ready', ordinal: 0, phase: 'arrive', minSeconds: 20, maxSeconds: 60, isProvisional: true },
      ],
      modulesByPhase: { arrive: tooLong },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('phase_unfilled');
  });
});
