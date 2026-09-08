/**
 * Provider rate cards.
 *
 * NO VENDOR PRICE APPEARS IN THIS FILE, OR ANYWHERE ELSE IN DOMAIN LOGIC.
 * Rates are configuration loaded from `provider_pricing`, referenced by a
 * version. That is the whole point: a price baked into code is a price that
 * silently rewrites history the day it changes, because every previously
 * calculated cost would recompute at the new rate.
 *
 * The rule this enforces: a price change publishes a NEW `pricingVersion`. An
 * existing version is never edited. The database backs that with an
 * append-only trigger; this module refuses to work with a card that cannot be
 * identified by version.
 */

export const COST_UNITS = [
  'llm_input_token',
  'llm_output_token',
  'tts_character',
  'delivery_byte',
] as const;

export type CostUnit = (typeof COST_UNITS)[number];

export type RateCard = {
  /** Immutable identifier. Recorded on every priced session. */
  pricingVersion: string;
  /** ISO 4217, upper case. */
  currency: string;
  /** When this card came into force. */
  effectiveFrom: string;
  /**
   * Currency units per ONE MILLION units of the thing being billed.
   *
   * Chosen so vendor quotes land on exact decimals rather than on values a
   * float would mangle, and so that cost in micros is a plain multiplication:
   * see `costMicros`.
   */
  ratesPerMillion: Readonly<Record<CostUnit, number>>;
};

/** A version must be identifiable and safe to put in a key or a log line. */
const VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class RateCardError extends Error {
  constructor(message: string) {
    super(`[ELSEA] ${message}`);
    this.name = 'RateCardError';
  }
}

/**
 * Validates a card before anything is priced with it.
 *
 * Every unit must be present, even at zero. A card missing a unit would price
 * that unit as nothing and under-report the session, which is the specific
 * failure this whole design exists to prevent — an under-report looks exactly
 * like good margin.
 */
export function assertRateCard(card: RateCard): void {
  if (!VERSION_PATTERN.test(card.pricingVersion)) {
    throw new RateCardError(`Unusable pricing version: ${JSON.stringify(card.pricingVersion)}`);
  }

  if (!CURRENCY_PATTERN.test(card.currency)) {
    throw new RateCardError(`Currency must be ISO 4217, got ${JSON.stringify(card.currency)}`);
  }

  for (const unit of COST_UNITS) {
    const rate = card.ratesPerMillion[unit];

    if (typeof rate !== 'number' || !Number.isFinite(rate)) {
      throw new RateCardError(`Rate card ${card.pricingVersion} has no usable rate for ${unit}`);
    }

    if (rate < 0) {
      throw new RateCardError(`Rate card ${card.pricingVersion} has a negative rate for ${unit}`);
    }
  }
}

/**
 * Cost in integer micros — millionths of one currency unit.
 *
 * Because a rate is quoted per million units, cost in micros is exactly
 * `quantity * ratePerMillion`. Worth stating, because it looks like a missing
 * conversion until you follow the units through:
 *
 *   micros    = currency * 1e6
 *   currency  = quantity * ratePerMillion / 1e6
 *   micros    = quantity * ratePerMillion
 *
 * Rounded to an integer at the boundary so no fraction of a micro ever
 * survives into storage or a sum.
 */
export function costMicros(quantity: number, ratePerMillion: number): number {
  if (quantity < 0) throw new RateCardError('Quantity cannot be negative.');
  return Math.round(quantity * ratePerMillion);
}

/**
 * The rate for a unit, refusing to guess.
 *
 * Throws rather than defaulting to zero when a quantity is billable but the
 * card cannot price it. Silence here would show up as a cheaper session, not
 * as an error, and nobody goes looking for a bug that improves the numbers.
 */
export function rateFor(card: RateCard, unit: CostUnit): number {
  const rate = card.ratesPerMillion[unit];
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new RateCardError(`Rate card ${card.pricingVersion} cannot price ${unit}`);
  }
  return rate;
}

/** Micros to a display string. Reporting only — never fed back into arithmetic. */
export function formatMicros(micros: number, currency: string): string {
  return `${(micros / 1_000_000).toFixed(6)} ${currency}`;
}
