import {
  assertRateCard,
  costMicros,
  COST_UNITS,
  rateFor,
  type RateCard,
} from '@/lib/cost/rate-card';
import * as rateCardModule from '@/lib/cost/rate-card';
import * as sessionCostModule from '@/lib/cost/session-cost';
import {
  priceSession,
  reuseRatio,
  totalCostMicros,
  type SessionUsage,
} from '@/lib/cost/session-cost';

/**
 * Cost telemetry and pricing-version integrity.
 *
 * The failure these guard against is not a crash. It is a cost that quietly
 * under-reports, or a historical figure that quietly changes when a vendor
 * reprices — both of which look like better margin, which is why nobody would
 * ever go looking for them.
 *
 * The rates below are ARBITRARY TEST FIXTURES, not vendor prices. Real rates
 * live in `provider_pricing` and are never compiled into the product.
 */

const cardA: RateCard = {
  pricingVersion: '2026-01-01.test-a',
  currency: 'USD',
  effectiveFrom: '2026-01-01T00:00:00Z',
  ratesPerMillion: {
    llm_input_token: 1,
    llm_output_token: 10,
    tts_character: 100,
    delivery_byte: 0.0001,
  },
};

/** Same shape, different prices. Stands in for "the vendor put prices up". */
const cardB: RateCard = {
  ...cardA,
  pricingVersion: '2026-06-01.test-b',
  effectiveFrom: '2026-06-01T00:00:00Z',
  ratesPerMillion: {
    llm_input_token: 2,
    llm_output_token: 20,
    tts_character: 400,
    delivery_byte: 0.0002,
  },
};

const usage = (over: Partial<SessionUsage> = {}): SessionUsage => ({
  llm: { provider: 'test', model: 'test-small', inputTokens: 400, outputTokens: 60 },
  tts: { provider: 'test', model: 'test-voice', characters: 400, seconds: 30 },
  segments: { generated: 2, cached: 0, library: 5 },
  deliveryBytes: 5_000_000,
  ...over,
});

describe('pricing-version integrity', () => {
  it('stamps the version used onto the priced session', () => {
    // Without this a stored cost is uninterpretable: the number means nothing
    // unless you know which rate card produced it.
    expect(priceSession(usage(), cardA).pricingVersion).toBe('2026-01-01.test-a');
  });

  it('does not change a historical cost when prices change', () => {
    // The property the whole design exists for. Pricing the same usage under a
    // new card produces a new figure; it does not reach back and alter the old
    // one.
    const historical = priceSession(usage(), cardA);
    const current = priceSession(usage(), cardB);

    // 400*1 + 60*10 = 1,000 llm; 400*100 = 40,000 tts; 5e6*0.0001 = 500 delivery.
    expect(historical.totalVariableCostMicros).toBe(41_500);
    // Same usage, dearer card: 2,000 + 160,000 + 1,000.
    expect(current.totalVariableCostMicros).toBe(163_000);
    // And the historical figure is untouched by the existence of the new one.
    expect(historical.totalVariableCostMicros).toBe(41_500);
    expect(historical.pricingVersion).not.toBe(current.pricingVersion);
  });

  it('prices identically for identical inputs, with no hidden state', () => {
    expect(priceSession(usage(), cardA)).toEqual(priceSession(usage(), cardA));
  });

  it('rejects a card missing a rate rather than pricing that unit at zero', () => {
    // An under-report looks like good margin, so it must be an error.
    const broken = {
      ...cardA,
      ratesPerMillion: { ...cardA.ratesPerMillion },
    } as unknown as RateCard;
    delete (broken.ratesPerMillion as Record<string, number>).tts_character;

    expect(() => priceSession(usage(), broken)).toThrow(/cannot price|no usable rate/i);
  });

  it('rejects negative, non-finite, malformed and non-ISO cards', () => {
    expect(() =>
      assertRateCard({ ...cardA, ratesPerMillion: { ...cardA.ratesPerMillion, tts_character: -1 } })
    ).toThrow(/negative/i);

    expect(() =>
      assertRateCard({
        ...cardA,
        ratesPerMillion: { ...cardA.ratesPerMillion, tts_character: Number.NaN },
      })
    ).toThrow(/no usable rate/i);

    expect(() => assertRateCard({ ...cardA, pricingVersion: 'X' })).toThrow(/pricing version/i);
    expect(() => assertRateCard({ ...cardA, currency: 'dollars' })).toThrow(/ISO 4217/i);
  });

  it('covers every billable unit, so none can be forgotten', () => {
    for (const unit of COST_UNITS) {
      expect(typeof rateFor(cardA, unit)).toBe('number');
    }
  });

  it('refuses to total across currencies', () => {
    const usd = priceSession(usage(), cardA);
    const gbp = priceSession(usage(), { ...cardA, currency: 'GBP' });

    expect(() => totalCostMicros([usd, gbp])).toThrow(/across currencies/i);
    expect(totalCostMicros([usd, usd])).toBe(usd.totalVariableCostMicros * 2);
  });
});

describe('cost arithmetic', () => {
  it('keeps money in integer micros, never floats', () => {
    const cost = priceSession(usage(), cardA);

    for (const value of [
      cost.llmCostMicros,
      cost.ttsCostMicros,
      cost.deliveryCostMicros,
      cost.totalVariableCostMicros,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('computes cost in micros as quantity times rate-per-million', () => {
    // 400 characters at 100 currency units per million characters
    //   = 40,000 micros = 0.04 of a currency unit.
    expect(costMicros(400, 100)).toBe(40_000);
    expect(costMicros(0, 100)).toBe(0);
  });

  it('makes the total exactly the sum of its parts', () => {
    const cost = priceSession(usage(), cardA);

    expect(cost.totalVariableCostMicros).toBe(
      cost.llmCostMicros + cost.ttsCostMicros + cost.deliveryCostMicros
    );
  });

  it('records characters submitted, which is what is billed', () => {
    // Not the length of what the person heard: providers charge for text they
    // were asked to synthesise, including audio later discarded.
    const cost = priceSession(
      usage({ tts: { provider: 'test', model: 'v', characters: 900, seconds: 30 } }),
      cardA
    );

    expect(cost.ttsCharacters).toBe(900);
    expect(cost.ttsCostMicros).toBe(90_000);
  });
});

describe('the composition mix is what makes the economics work', () => {
  it('costs nothing in speech when every segment was cached or from the library', () => {
    // The architecture's promise: a session served entirely from reusable
    // content bills no TTS at all, however many times it is played.
    const cost = priceSession(
      usage({ tts: null, segments: { generated: 0, cached: 2, library: 5 } }),
      cardA
    );

    expect(cost.ttsCostMicros).toBe(0);
    expect(cost.ttsProvider).toBeNull();
    expect(cost.totalVariableCostMicros).toBe(
      cost.llmCostMicros + cost.deliveryCostMicros
    );
  });

  it('makes a cache hit strictly cheaper than a generation', () => {
    const generated = priceSession(usage(), cardA);
    const cached = priceSession(
      usage({ tts: null, segments: { generated: 0, cached: 2, library: 5 } }),
      cardA
    );

    expect(cached.totalVariableCostMicros).toBeLessThan(generated.totalVariableCostMicros);
  });

  it('reports the share of segments that cost nothing to serve again', () => {
    expect(reuseRatio({ generated: 2, cached: 3, library: 5 })).toBeCloseTo(0.8);
    expect(reuseRatio({ generated: 0, cached: 0, library: 4 })).toBe(1);
    expect(reuseRatio({ generated: 4, cached: 0, library: 0 })).toBe(0);
  });

  it('returns no ratio rather than inventing one for an empty session', () => {
    expect(reuseRatio({ generated: 0, cached: 0, library: 0 })).toBeNull();
  });

  it('prices a session that skipped interpretation entirely', () => {
    // The shortcut path: a state pill, no free text, no LLM call.
    const cost = priceSession(usage({ llm: null }), cardA);

    expect(cost.llmCostMicros).toBe(0);
    expect(cost.llmProvider).toBeNull();
  });
});

describe('no vendor price is compiled into the product', () => {
  it('exports no built-in rate card from either cost module', () => {
    // Rates are configuration from `provider_pricing`, referenced by version.
    // A rate baked into code silently rewrites every historical cost the day
    // the vendor changes it, so nothing here may carry one.
    const modules: Record<string, unknown>[] = [rateCardModule, sessionCostModule];

    for (const mod of modules) {
      for (const value of Object.values(mod)) {
        expect(value).not.toHaveProperty('ratesPerMillion');
        expect(value).not.toHaveProperty('pricingVersion');
      }
    }
  });
});
