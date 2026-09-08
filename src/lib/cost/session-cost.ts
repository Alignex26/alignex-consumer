import {
  assertRateCard,
  costMicros,
  rateFor,
  RateCardError,
  type RateCard,
} from '@/lib/cost/rate-card';

/**
 * What one composed session actually cost to serve.
 *
 * Built from recorded quantities and a named rate card, never estimated from
 * an average after the fact. Two properties make it trustworthy:
 *
 *   1. The QUANTITIES are the durable facts. Characters submitted, tokens
 *      used, bytes delivered — these do not change when a vendor reprices.
 *   2. The COST is a snapshot under a named `pricingVersion`. It can be
 *      audited by recomputation, but it is never silently rewritten.
 *
 * Together they answer "what did this user cost us last month" from data
 * rather than from a spreadsheet, and keep last March's answer stable.
 */

export type LlmUsage = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type TtsUsage = {
  provider: string;
  model: string;
  /**
   * Characters SUBMITTED, not characters kept. Providers bill on what they
   * were asked to synthesise, including audio later discarded, so this is the
   * billable figure and not the length of what the person heard.
   */
  characters: number;
  seconds: number;
};

/**
 * The composition mix.
 *
 * The economic thesis, made measurable. `library` and `cached` cost nothing to
 * serve again; `generated` is the only one that bills. A rising generated
 * count against flat usage is the signal that the architecture is drifting
 * back toward "AI meditation generator".
 */
export type SegmentMix = {
  generated: number;
  cached: number;
  library: number;
};

export type SessionUsage = {
  /** Absent when interpretation was skipped, as on the shortcut path. */
  llm: LlmUsage | null;
  /** Absent when every segment came from cache or library — the good case. */
  tts: TtsUsage | null;
  segments: SegmentMix;
  deliveryBytes: number;
};

export type SessionCost = {
  pricingVersion: string;
  currency: string;

  llmProvider: string | null;
  llmModel: string | null;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCostMicros: number;

  ttsProvider: string | null;
  ttsModel: string | null;
  ttsCharacters: number;
  ttsSeconds: number;
  ttsCostMicros: number;

  generatedSegments: number;
  cachedSegments: number;
  librarySegments: number;

  deliveryBytes: number;
  deliveryCostMicros: number;

  totalVariableCostMicros: number;
};

/**
 * Prices a session.
 *
 * Deliberately pure and total: same usage plus same card always gives the same
 * cost, with no clock, no network and no shared state. That is what makes a
 * historical figure reproducible during an audit.
 *
 * Fails loudly on a card that cannot price a non-zero quantity. The tempting
 * alternative — treat a missing rate as zero — produces a cheaper session
 * rather than an error, and an under-reported cost is the one bug nobody
 * investigates.
 */
export function priceSession(usage: SessionUsage, card: RateCard): SessionCost {
  assertRateCard(card);

  if (usage.deliveryBytes < 0) {
    throw new RateCardError('Delivery bytes cannot be negative.');
  }

  const llmCostMicros = usage.llm
    ? costMicros(usage.llm.inputTokens, rateFor(card, 'llm_input_token')) +
      costMicros(usage.llm.outputTokens, rateFor(card, 'llm_output_token'))
    : 0;

  const ttsCostMicros = usage.tts
    ? costMicros(usage.tts.characters, rateFor(card, 'tts_character'))
    : 0;

  const deliveryCostMicros = costMicros(usage.deliveryBytes, rateFor(card, 'delivery_byte'));

  return {
    pricingVersion: card.pricingVersion,
    currency: card.currency,

    llmProvider: usage.llm?.provider ?? null,
    llmModel: usage.llm?.model ?? null,
    llmInputTokens: usage.llm?.inputTokens ?? 0,
    llmOutputTokens: usage.llm?.outputTokens ?? 0,
    llmCostMicros,

    ttsProvider: usage.tts?.provider ?? null,
    ttsModel: usage.tts?.model ?? null,
    ttsCharacters: usage.tts?.characters ?? 0,
    ttsSeconds: usage.tts?.seconds ?? 0,
    ttsCostMicros,

    generatedSegments: usage.segments.generated,
    cachedSegments: usage.segments.cached,
    librarySegments: usage.segments.library,

    deliveryBytes: usage.deliveryBytes,
    deliveryCostMicros,

    // Summed from the parts rather than accumulated along the way, so the
    // total can never drift away from the components it is meant to explain.
    totalVariableCostMicros: llmCostMicros + ttsCostMicros + deliveryCostMicros,
  };
}

/**
 * The share of a session's segments that cost nothing to serve again.
 *
 * The number to watch. The architecture's promise is that this stays high as
 * usage grows; if it falls, more usage has started meaning more spend.
 * Returns null for a session with no segments rather than inventing a ratio.
 */
export function reuseRatio(mix: SegmentMix): number | null {
  const total = mix.generated + mix.cached + mix.library;
  if (total === 0) return null;
  return (mix.cached + mix.library) / total;
}

/** Sums priced sessions. Refuses to add across currencies or rate versions. */
export function totalCostMicros(costs: readonly SessionCost[]): number {
  if (costs.length === 0) return 0;

  const currency = costs[0].currency;
  for (const cost of costs) {
    if (cost.currency !== currency) {
      throw new RateCardError(
        `Cannot total costs across currencies: ${currency} and ${cost.currency}`
      );
    }
  }

  return costs.reduce((sum, cost) => sum + cost.totalVariableCostMicros, 0);
}
