import type { SpeechRequest } from './types.ts';

/**
 * The voice provider boundary (Rule 7).
 *
 * WHY THIS EXISTS BEFORE ANY PROVIDER DOES. TTS is roughly 97% of the marginal
 * cost of a session, so switching provider is the single largest cost lever in
 * the product. A vendor SDK reached for directly from the composition path
 * would put that lever behind a rewrite. This interface is the whole point:
 * ELSEA asks for speech, something else decides who makes it.
 *
 * WHERE THIS RUNS. Server-side only, in an Edge Function alongside the safety
 * gate. No provider key is bundled client-side, and no `EXPO_PUBLIC_` variable
 * ever holds one. The client receives a manifest of storage paths and never
 * holds a credential or calls a vendor.
 *
 * Nothing is wired yet. Choosing a provider is a product decision, and the
 * published prices that would inform it move often enough that they should be
 * checked at the time rather than baked in here.
 */

export type VoiceProviderId = string;

export type SynthesisRequest = {
  text: string;
  voice: string;
  /** Bounded by the caller before it reaches here. See `budget.ts`. */
  characterCount: number;
};

export type SynthesisResult = {
  /** Where the rendered audio was written. */
  storagePath: string;
  durationSeconds: number;
  /**
   * Characters actually billed. Recorded rather than assumed: providers bill
   * on what was submitted, including output later discarded, so the estimate
   * and the invoice can disagree and only one of them is true.
   */
  billedCharacters: number;
};

export type VoiceProvider = {
  id: VoiceProviderId;
  synthesise: (request: SynthesisRequest) => Promise<SynthesisResult>;
};

/**
 * Resolving a speech request.
 *
 * The order is deliberate and is where the money is saved:
 *
 *   1. cache hit  -> free, and the common case once the situation cache warms
 *   2. cache miss -> synthesise ONCE, write through, then play
 *
 * Write-through before playback is the part that matters. TTS bills on
 * characters submitted, so a session that fails after generating and is then
 * retried would otherwise pay twice for identical audio. Because the key is
 * derived deterministically from structured state, the retry hits the cache.
 */
export type SpeechResolver = {
  /** Returns a storage path, from cache where possible. */
  resolve: (request: SpeechRequest) => Promise<string>;
};

/**
 * Guard for the composition path.
 *
 * Composition must never call a provider directly; it emits requests and lets
 * the resolver decide. Kept as a named error so a future change that reaches
 * for a vendor from the wrong layer fails loudly rather than quietly costing
 * money on every session.
 */
export class VoiceBoundaryError extends Error {
  constructor(message: string) {
    super(`[ELSEA] ${message}`);
    this.name = 'VoiceBoundaryError';
  }
}
