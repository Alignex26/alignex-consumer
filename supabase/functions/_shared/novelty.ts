// supabase/functions/_shared/novelty.ts
//
// "Fresh by default. Repeat on purpose."
//
// Two different things that look alike and must not share a code path:
//
//   ACCIDENTAL REPETITION — the composer happening to serve the same
//   experience twice because the library is small. Undesirable.
//
//   INTENTIONAL REPLAY — someone asking for a session they saved because it
//   worked. Desirable, and must not be defeated by the machinery that
//   prevents the first.
//
// This module supplies the fingerprint that tells them apart, and the recency
// scoring that keeps ordinary composition fresh.
//
// SERVER-SIDE ONLY, like everything in `_shared`. Dependency-free.

import type { SessionManifest } from './types.ts';

// ---------------------------------------------------------------------------
// Fingerprints
// ---------------------------------------------------------------------------

/**
 * A stable identity for the *meaningful* composition of a session.
 *
 * WHAT IT INCLUDES: the recipe, and the ordered module identities with their
 * content versions. That is what a person actually experiences.
 *
 * WHAT IT DELIBERATELY EXCLUDES:
 *
 *   - SIGNED URLS. They are transport, they expire in two hours, and they
 *     differ on every single request. Including them would make every session
 *     unique and the whole freshness check inert while appearing to work.
 *   - Silence, offsets and total duration. A five and a ten minute session
 *     built from the same modules in the same order are the same *experience*
 *     at different lengths; treating them as distinct would let the composer
 *     serve the same content twice by varying the length.
 *   - Beds. A background layer is not what makes a session recognisable.
 *
 * The version is part of the identity on purpose: if a module's approved
 * content is replaced, sessions built from the old one are no longer the same
 * experience, and should not be treated as recently heard.
 */
export function manifestFingerprint(
  manifest: SessionManifest,
  versions: ReadonlyMap<string, number> = new Map()
): string {
  const parts = manifest.segments
    .filter((s) => s.kind === 'module' && s.layer === 'foreground')
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((s) => {
      const segment = s as { moduleId: string };
      return `${segment.moduleId}@${versions.get(segment.moduleId) ?? 1}`;
    });

  return `${manifest.transitionKey}|${parts.join(',')}`;
}

/** The module identities a fingerprint is built from, in order. */
export function fingerprintModules(fingerprint: string): string[] {
  const [, joined = ''] = fingerprint.split('|');
  return joined === '' ? [] : joined.split(',');
}

// ---------------------------------------------------------------------------
// Recency
// ---------------------------------------------------------------------------

/**
 * How strongly recent exposure counts against a module.
 *
 * EVERY NUMBER HERE IS A PRODUCT DECISION THAT HAS NOT BEEN MADE. They are
 * defaults chosen so the mechanism can be exercised and simulated, not
 * findings. `docs/session-engine.md` records what still needs deciding, and
 * `novelty-simulation.test.ts` exists so the decision can be made from
 * evidence rather than taste.
 */
export type NoveltyPolicy = {
  /** How many of a person's recent sessions are considered. */
  lookbackSessions: number;
  /**
   * Penalty applied to a module heard in the most recent session, decaying
   * linearly to zero across the lookback window.
   *
   * Deliberately smaller than the gap between a well-rated and an unrated
   * module, so novelty reorders equals and never buries something that works.
   */
  maxPenalty: number;
  /** Never let recency push a score below this, whatever the exposure. */
  penaltyFloor: number;
};

export const DEFAULT_NOVELTY: NoveltyPolicy = {
  lookbackSessions: 5,
  maxPenalty: 0.15,
  penaltyFloor: 0.05,
};

/**
 * Adjusts effectiveness scores by recent exposure.
 *
 * `recent` is ordered most-recent-first: the module ids heard in each of the
 * person's last few sessions.
 *
 * NOVELTY NEVER BANS A MODULE. The penalty is bounded and the result is
 * floored, so the single most effective module for someone stays reachable
 * even if they heard it yesterday. That matters: rule 8 says the person hears
 * what works for them, and a freshness mechanism that quietly overrides it
 * would be trading effectiveness for variety without anyone deciding to.
 */
export function applyRecency(
  scores: ReadonlyMap<string, number>,
  recent: readonly (readonly string[])[],
  policy: NoveltyPolicy = DEFAULT_NOVELTY,
  neutralScore = 0.5
): Map<string, number> {
  const adjusted = new Map(scores);
  const window = recent.slice(0, policy.lookbackSessions);

  window.forEach((session, index) => {
    // Most recent session carries the full penalty; the oldest in the window
    // carries almost none.
    const recencyWeight = (window.length - index) / window.length;
    const penalty = policy.maxPenalty * recencyWeight;

    for (const moduleId of session) {
      const current = adjusted.get(moduleId) ?? neutralScore;
      adjusted.set(moduleId, Math.max(policy.penaltyFloor, current - penalty));
    }
  });

  return adjusted;
}

/**
 * Whether a freshly composed manifest is one this person has just had.
 *
 * Used to retry composition rather than to fail it: an identical session is
 * disappointing, not unsafe, and refusing to serve anything would be worse.
 */
export function isRecentlySeen(
  fingerprint: string,
  recentFingerprints: readonly string[],
  lookback: number = DEFAULT_NOVELTY.lookbackSessions
): boolean {
  return recentFingerprints.slice(0, lookback).includes(fingerprint);
}
