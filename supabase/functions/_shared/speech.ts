import type { SpeechContext, SpeechRequest, SpeechSlot } from './types.ts';

/**
 * The dynamic speech budget and the cache key.
 *
 * SERVER-SIDE ONLY. This never ships to a device. The budget is enforced where
 * the paid provider can actually be called, and a ceiling the client could see
 * — or skip — is not a ceiling.
 *
 * WHY THIS IS A HARD CONSTRAINT RATHER THAN A GUIDELINE. Dynamic TTS is
 * roughly 97% of the marginal cost of a session; library audio, interpretation
 * and CDN egress together are rounding. So the number of seconds spoken per
 * session is very nearly the entire unit-economics story, and "the model will
 * generate what it thinks is necessary" is how that number escapes.
 *
 * The budget is checked at composition, BEFORE any provider is called, and a
 * manifest over the ceiling is rejected rather than silently trimmed — a quiet
 * trim would hide the drift that the ceiling exists to catch.
 */

export const DynamicBudget = {
  /** Rule 4. A normal session. */
  normalSeconds: 30,
  /** Rule 4. Hard ceiling; an exceptional session may reach this and no further. */
  ceilingSeconds: 45,
  /**
   * Characters per second of calm, guided delivery.
   *
   * ~130 words per minute at ~6 characters per word including the space. Used
   * to price and bound text before it is sent anywhere. Deliberately a single
   * named constant: if the voice is re-tuned this is the one number to change.
   */
  charactersPerSecond: 13,
} as const;

/** Seconds of speech a piece of text will take. */
export function estimateSpeechSeconds(text: string): number {
  return text.length / DynamicBudget.charactersPerSecond;
}

/** The character allowance for a number of seconds. */
export function charactersFor(seconds: number): number {
  return Math.floor(seconds * DynamicBudget.charactersPerSecond);
}

export type BudgetVerdict =
  | { ok: true; totalSeconds: number; exceptional: boolean }
  | { ok: false; totalSeconds: number };

/**
 * Whether a set of speech requests fits.
 *
 * `exceptional` marks a session over the normal 30s but within the 45s
 * ceiling. It is reported rather than blocked, because the locked direction
 * allows an exceptional session — but it is surfaced so that "exceptional"
 * cannot quietly become the average.
 */
export function checkBudget(requests: readonly SpeechRequest[]): BudgetVerdict {
  const totalSeconds = requests.reduce((sum, r) => sum + r.estimatedSeconds, 0);

  if (totalSeconds > DynamicBudget.ceilingSeconds) {
    return { ok: false, totalSeconds };
  }

  return {
    ok: true,
    totalSeconds,
    exceptional: totalSeconds > DynamicBudget.normalSeconds,
  };
}

/**
 * A context tag is the one field in `SpeechContext` that is not drawn from a
 * closed vocabulary, so it is the one place raw user text could leak into a
 * cache key or into speech. Anything that is not a short lower-case token is
 * refused outright.
 */
const SAFE_CONTEXT_TAG = /^[a-z0-9_]{1,32}$/;

export function isSafeContextTag(tag: string | null): boolean {
  return tag === null || SAFE_CONTEXT_TAG.test(tag);
}

/**
 * Intensity buckets.
 *
 * A cache keyed on raw 1-10 intensity would almost never hit. Three bands keep
 * the key coarse enough to be reused while still varying the line meaningfully.
 */
export function intensityBand(intensity: number): 'low' | 'medium' | 'high' {
  if (intensity <= 3) return 'low';
  if (intensity <= 7) return 'medium';
  return 'high';
}

/**
 * The cache key for a piece of dynamic speech.
 *
 * Derived entirely from structured state. There is no parameter for user text
 * and no way to pass one, which is what makes the situation cache safe to
 * share between people: two people in the same structured situation get the
 * same key, and neither key contains anything either of them wrote.
 *
 * Throws on an unsafe context tag rather than sanitising it. Sanitising would
 * mean a malformed tag still produced a key, and the point is to fail closed.
 */
export function speechCacheKey(context: SpeechContext): string {
  if (!isSafeContextTag(context.contextTag)) {
    throw new Error('[ELSEA] Unsafe context tag rejected before cache key derivation.');
  }

  return [
    context.slot,
    context.transitionKey,
    context.stateCurrent,
    context.stateTarget,
    context.contextTag ?? 'none',
    intensityBand(context.intensity),
  ].join(':');
}

/**
 * Which cache a slot's speech belongs in.
 *
 * A line built only from structured state is identical for everyone in that
 * situation, so it belongs in the shared `situation` cache and is paid for
 * once across every person who ever lands there. `personal` is reserved for
 * speech that genuinely depends on an individual's history, which nothing in
 * V1 produces yet.
 */
export function scopeFor(_slot: SpeechSlot): 'situation' {
  return 'situation';
}

/**
 * Builds a speech request from structured state.
 *
 * `compose` is the only intended caller. The text itself is supplied by the
 * caller rather than written here: what ELSEA says is copy, and copy is not an
 * engineering decision. This function's job is to attach the derived key, cost
 * the text, and refuse anything that cannot be safely keyed.
 */
export function speechRequest(context: SpeechContext, text: string): SpeechRequest {
  return {
    slot: context.slot,
    scope: scopeFor(context.slot),
    cacheKey: speechCacheKey(context),
    text,
    estimatedSeconds: estimateSpeechSeconds(text),
  };
}
