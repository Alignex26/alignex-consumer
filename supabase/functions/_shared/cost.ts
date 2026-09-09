// supabase/functions/_shared/cost.ts
//
// Builds the `session_costs` row for a composed session.
//
// DORMANT BY DESIGN. Nothing calls this in production yet, because nothing
// generates anything to cost: no TTS provider is wired and interpretation
// currently runs without recorded token counts. The row would be all zeros,
// and a table full of zero-cost rows is worse than an empty one — it looks
// like cost telemetry while telling you nothing.
//
// It exists, and is tested, so that enabling generation is a matter of passing
// real usage in rather than designing this under time pressure later.
//
// Money is integer micros, never a float: a session's speech costs a fraction
// of a penny, so cents are too coarse and floats drift once summed.

import type { SessionManifest } from './types.ts';

export type RateCard = {
  pricingVersion: string;
  currency: string;
  /** Currency units per ONE MILLION units, so cost in micros is quantity * rate. */
  ratesPerMillion: {
    llm_input_token: number;
    llm_output_token: number;
    tts_character: number;
    delivery_byte: number;
  };
};

export type SessionUsage = {
  llm: { provider: string; model: string; inputTokens: number; outputTokens: number } | null;
  /** Characters SUBMITTED, which is what providers bill, not what was kept. */
  tts: { provider: string; model: string; characters: number; seconds: number } | null;
  deliveryBytes: number;
  /** Generated speech served from cache rather than synthesised. */
  cachedSegments: number;
};

export type CostRow = Record<string, unknown>;

/**
 * The segment mix, derived from the manifest rather than passed in.
 *
 * Deriving it means it cannot disagree with what was actually composed — the
 * ratio of reusable to generated content is the whole economic thesis, and a
 * hand-supplied number would be the first thing to drift.
 */
export function segmentMix(manifest: SessionManifest, cachedSegments = 0) {
  const generated = manifest.segments.filter((s) => s.kind === 'generated').length;
  const library = manifest.segments.filter((s) => s.kind === 'module').length;

  return {
    generated: Math.max(0, generated - cachedSegments),
    cached: Math.min(cachedSegments, generated),
    library,
  };
}

/** Cost in integer micros. Quantity times rate-per-million; see the docblock. */
function micros(quantity: number, ratePerMillion: number): number {
  if (quantity < 0) throw new Error('[ELSEA] Quantity cannot be negative.');
  return Math.round(quantity * ratePerMillion);
}

/**
 * Builds the row. Pure: same inputs, same row, no clock and no network, so a
 * historical figure can be reproduced during an audit.
 *
 * Throws rather than costing an unpriceable quantity at zero. An under-report
 * looks like better margin, which is the one bug nobody investigates.
 */
export function costRowFor(
  manifestId: string,
  userId: string | null,
  manifest: SessionManifest,
  usage: SessionUsage,
  card: RateCard
): CostRow {
  for (const [unit, rate] of Object.entries(card.ratesPerMillion)) {
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) {
      throw new Error(`[ELSEA] Rate card ${card.pricingVersion} cannot price ${unit}`);
    }
  }

  const llmCost = usage.llm
    ? micros(usage.llm.inputTokens, card.ratesPerMillion.llm_input_token) +
      micros(usage.llm.outputTokens, card.ratesPerMillion.llm_output_token)
    : 0;

  const ttsCost = usage.tts
    ? micros(usage.tts.characters, card.ratesPerMillion.tts_character)
    : 0;

  const deliveryCost = micros(usage.deliveryBytes, card.ratesPerMillion.delivery_byte);
  const mix = segmentMix(manifest, usage.cachedSegments);

  return {
    manifest_id: manifestId,
    user_id: userId,
    pricing_version: card.pricingVersion,
    currency: card.currency,

    llm_provider: usage.llm?.provider ?? null,
    llm_model: usage.llm?.model ?? null,
    llm_input_tokens: usage.llm?.inputTokens ?? 0,
    llm_output_tokens: usage.llm?.outputTokens ?? 0,
    llm_cost_micros: llmCost,

    tts_provider: usage.tts?.provider ?? null,
    tts_model: usage.tts?.model ?? null,
    tts_characters: usage.tts?.characters ?? 0,
    tts_seconds: usage.tts?.seconds ?? 0,
    tts_cost_micros: ttsCost,

    generated_segments: mix.generated,
    cached_segments: mix.cached,
    library_segments: mix.library,

    delivery_bytes: usage.deliveryBytes,
    delivery_cost_micros: deliveryCost,

    // Summed from the parts, never accumulated along the way, so the total can
    // never drift from the components it is meant to explain.
    total_variable_cost_micros: llmCost + ttsCost + deliveryCost,
  };
}
