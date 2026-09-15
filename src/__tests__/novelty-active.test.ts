/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

import { compose } from '../../supabase/functions/_shared/compose';
import { DEFAULT_NOVELTY, applyRecency } from '../../supabase/functions/_shared/novelty';
import type { InterventionModule, RecipePhase } from '../../supabase/functions/_shared/types';

/**
 * NOVELTY, ACTIVATED.
 *
 * The machinery existed and was tested for days without being called. Every
 * session of the same recipe at the same duration returned the SAME manifest,
 * for ever, however large the library grew — measured over 600 simulated
 * sessions, which produced exactly one manifest per case. Selection is
 * deterministic: `pick` takes longest-then-key, and with no history every score
 * is neutral.
 *
 * So the test that matters is not "is `applyRecency` correct" — that was already
 * covered. It is "does composing twice now give something different", and "does
 * freshness still lose to something that works".
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const COMPOSE_FN = read('supabase', 'functions', 'compose', 'index.ts');
const SHARED = read('supabase', 'functions', '_shared', 'compose.ts');

const phase = (over: Partial<RecipePhase> = {}): RecipePhase => ({
  transitionKey: 't',
  ordinal: 0,
  phase: 'only',
  minSeconds: 60,
  maxSeconds: 60,
  isProvisional: false,
  ...over,
} as RecipePhase);

const module_ = (id: string, durationSeconds = 25): InterventionModule => ({
  id,
  moduleKey: id,
  family: 'orient',
  techniqueKey: 't',
  storagePath: `modules/${id}.m4a`,
  durationSeconds,
  intensity: 5,
  requiresHeadphones: false,
  isBed: false,
  version: 1,
} as InterventionModule);

/**
 * Two interchangeable modules, one 60s phase, and only room for ONE of them.
 *
 * 40s each is deliberate: `fillPhase` chains while anything still fits, so two
 * 25s modules would both be selected and the test would prove nothing about
 * which one was preferred. At 40s the second cannot follow the first, and the
 * choice is forced into the open.
 */
const INPUT = {
  transitionKey: 't',
  durationSeconds: 60,
  phases: [phase()],
  modulesByPhase: { only: [module_('a', 40), module_('b', 40)] },
};

const chosen = (result: ReturnType<typeof compose>) => {
  if (!result.ok) throw new Error(`composition failed: ${result.failure}`);
  return result.manifest.segments
    .filter((s) => s.kind === 'module')
    .map((s) => (s as { moduleId: string }).moduleId);
};

describe('a second session differs from the first', () => {
  it('with no history, selection is deterministic — the old behaviour', () => {
    const first = chosen(compose({ ...INPUT }));
    const second = chosen(compose({ ...INPUT }));
    expect(first).toEqual(second);
  });

  it('having heard a module, the next session reaches for the other one', () => {
    // This is the whole point. Without `recent`, both sessions return `a`.
    const first = chosen(compose({ ...INPUT }));
    const second = chosen(compose({ ...INPUT, recent: [first] }));
    expect(second).not.toEqual(first);
  });

  it('and the one before that comes back when it is no longer recent', () => {
    // The penalty decays across the lookback window, so nothing is exiled.
    const first = chosen(compose({ ...INPUT }));
    const second = chosen(compose({ ...INPUT, recent: [first] }));
    const third = chosen(compose({
      ...INPUT,
      // `first` has now aged out of a one-session window.
      recent: [second],
    }));
    expect(third).toEqual(first);
  });
});

describe('freshness never outranks what works', () => {
  it('a module that works for this person survives being heard recently', () => {
    // Rule 8: the person hears what works for them. A recency penalty that
    // could bury a well-rated module would trade effectiveness for variety
    // without anyone deciding to.
    const result = chosen(compose({
      ...INPUT,
      effectiveness: [{ moduleId: 'a', positive: 9, total: 10 }],
      recent: [['a'], ['a'], ['a'], ['a'], ['a']],
    }));
    expect(result).toEqual(['a']);
  });

  it('the penalty is bounded and floored, whatever the exposure', () => {
    const scores = new Map([['x', 0.5]]);
    const hammered = applyRecency(scores, Array.from({ length: 50 }, () => ['x']));
    expect(hammered.get('x')).toBeGreaterThanOrEqual(DEFAULT_NOVELTY.penaltyFloor);
  });

  it('never bans a module — a single candidate is still chosen', () => {
    const single = {
      ...INPUT,
      modulesByPhase: { only: [module_('a', 40)] },
      recent: [['a'], ['a'], ['a']],
    };
    expect(chosen(compose(single))).toEqual(['a']);
  });
});

describe('the wiring is real, not a flag', () => {
  it('the decision engine applies recency to its scores', () => {
    expect(SHARED).toContain('applyRecency(scoresFrom(input.effectiveness ?? []), input.recent ?? [])');
  });

  it('effectiveness is applied first, recency on top', () => {
    // The reverse would let freshness decide outright.
    expect(SHARED).toContain('Effectiveness first, then recency on top of it');
  });

  it('the Edge Function reads recent manifests and passes them', () => {
    expect(COMPOSE_FN).toContain('.from("session_manifests")');
    expect(COMPOSE_FN).toContain('manifest_segments(module_id)');
    expect(COMPOSE_FN).toContain('recent,');
  });

  it('the lookback is bounded by the policy, not unbounded', () => {
    expect(COMPOSE_FN).toContain('.limit(DEFAULT_NOVELTY.lookbackSessions)');
  });

  it('history comes from manifests, not from outcomes', () => {
    // A session counts as heard whether or not it was rated, and rating is
    // optional. Keying novelty to outcomes would make unrated sessions
    // invisible to it.
    const block = COMPOSE_FN.slice(COMPOSE_FN.indexOf("WHAT THEY HAVE JUST HEARD"));
    expect(block.slice(0, 600)).toContain('session_manifests');
    expect(block.slice(0, 600)).not.toContain('session_outcomes');
  });

  it('the comments no longer claim novelty is inactive', () => {
    expect(COMPOSE_FN).not.toContain('no recency weighting is active');
    expect(COMPOSE_FN).not.toContain('Recorded, not acted upon');
  });

  it('signed-out people still compose', () => {
    // `recent` is absent for anyone without an account, and that must not fail.
    expect(SHARED).toContain('input.recent ?? []');
    expect(chosen(compose({ ...INPUT, recent: undefined }))).toHaveLength(1);
  });
});

describe('the policy numbers are still defaults, not decisions', () => {
  it('says so where they live', () => {
    const novelty = read('supabase', 'functions', '_shared', 'novelty.ts');
    expect(novelty).toContain('PRODUCT DECISION THAT HAS NOT BEEN MADE');
  });

  it('and the function records that they remain undecided', () => {
    expect(COMPOSE_FN).toContain('remain defaults rather than product decisions');
  });
});
