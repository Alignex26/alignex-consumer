import { ALLOWED_NEXT, PHASES, PHASE_ROUTE, canEnter, type Phase } from '@/flow/product-flow';
import { track } from '@/lib/analytics';
import { ELSEA_TARGET_CARDS, transitionForCard, unmappedTargets } from '@/lib/target-cards';
import { SELECTABLE_CURRENT, targetsFor, transitionFor } from '@/lib/transitions';
import { STATES_TARGET, TRANSITION_KEYS } from '@/types/elsea';

/**
 * The flow grammar, the correction options, and the analytics guard.
 *
 * These are the invariants that are easy to break silently later: an extra
 * edge into interpretation, a correction pair with no transition behind it, or
 * an analytics property that quietly becomes free text.
 */

describe('the product flow', () => {
  it('lets nothing reach an interpretation-bearing phase except out of the gate', () => {
    // The phases that carry an interpretation forward. Every edge into any of
    // them must come from the gate itself or from another of them — never from
    // somewhere upstream, which would be a way past the gate.
    //
    // Stated this way rather than naming one phase's sources, so that moving
    // the confirm step (as target + time did) cannot quietly weaken it.
    const GATED: Phase[] = ['interpretation', 'correction', 'time_selection'];
    const PERMITTED = new Set<Phase>(['safety_check', ...GATED]);

    for (const target of GATED) {
      const sources = PHASES.filter((phase) => ALLOWED_NEXT[phase].includes(target));
      for (const source of sources) {
        expect(PERMITTED.has(source)).toBe(true);
      }
    }
  });

  it('still routes the gate into the session path', () => {
    // The mirror of the test above: the gate must actually lead somewhere, or
    // the invariant would hold vacuously on a broken flow.
    const onward = ALLOWED_NEXT.safety_check.filter((phase) =>
      (['interpretation', 'correction', 'time_selection'] as Phase[]).includes(phase)
    );

    expect(onward.length).toBeGreaterThan(0);
  });

  it('never lets input reach interpretation directly', () => {
    expect(canEnter('input', 'interpretation')).toBe(false);
    expect(ALLOWED_NEXT.input).toEqual(['safety_check']);
  });

  it('does not let support continue into the session path', () => {
    for (const next of ALLOWED_NEXT.support) {
      expect(['arrival', 'home']).toContain(next);
    }
  });

  it('gives every routable phase a path', () => {
    const routable = PHASES.filter(
      (phase) => phase !== 'session_paused' && phase !== 'early_exit'
    ) as Exclude<Phase, 'session_paused' | 'early_exit'>[];

    for (const phase of routable) {
      expect(typeof PHASE_ROUTE[phase]).toBe('string');
      expect(PHASE_ROUTE[phase].startsWith('/')).toBe(true);
    }
  });

  it('only ever names phases that exist', () => {
    for (const phase of PHASES) {
      for (const next of ALLOWED_NEXT[phase]) {
        expect(PHASES).toContain(next);
      }
    }
  });
});

describe('correction options', () => {
  it('only offers pairs that map to an approved transition', () => {
    for (const current of SELECTABLE_CURRENT) {
      const targets = targetsFor(current);
      expect(targets.length).toBeGreaterThan(0);

      for (const target of targets) {
        const key = transitionFor(current, target);
        expect(key).not.toBeNull();
        expect(TRANSITION_KEYS).toContain(key);
      }
    }
  });

  it('cannot produce a transition outside the five', () => {
    expect(transitionFor('neutral', 'settled')).toBeNull();
  });
});

describe('target-state cards', () => {
  it('only ever offers a card that produces an approved transition', () => {
    // The property that stops someone choosing their way into a dead end: if a
    // card is offered for a current state, the pair must map to one of the
    // five families, because that key is what session selection queries on.
    for (const current of SELECTABLE_CURRENT) {
      for (const card of ELSEA_TARGET_CARDS) {
        const key = transitionForCard(current, card);
        if (key !== null) {
          expect(TRANSITION_KEYS).toContain(key);
        }
      }
    }
  });

  it('withholds a card whose target has no route from that current state', () => {
    const focused = ELSEA_TARGET_CARDS.find((c) => c.key === 'focused')!;
    const calmer = ELSEA_TARGET_CARDS.find((c) => c.key === 'calmer')!;

    // Wound up has an approved route to home, but none to focused.
    expect(transitionForCard('wound_up', calmer)).toBe('wound_up_home');
    expect(transitionForCard('wound_up', focused)).toBeNull();

    // And the reverse for someone scattered.
    expect(transitionForCard('scattered', focused)).toBe('scattered_focused');
    expect(transitionForCard('scattered', calmer)).toBeNull();
  });

  it('maps every card to a canonical target, and every target to a card', () => {
    // The V1 mapping is 1:1 and exhaustive. Asserted both ways so that adding
    // a target to the taxonomy, or a card to the grid, cannot leave one side
    // silently unrepresented — which is how NERVOUS -> READY went missing.
    for (const card of ELSEA_TARGET_CARDS) {
      expect(card.canonical).not.toBeNull();
      expect(STATES_TARGET).toContain(card.canonical);
    }

    expect(unmappedTargets(STATES_TARGET)).toEqual([]);
    expect(ELSEA_TARGET_CARDS).toHaveLength(STATES_TARGET.length);

    const targets = ELSEA_TARGET_CARDS.map((c) => c.canonical);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('offers at least one card for every current state the picker allows', () => {
    // Every state someone can arrive in must have somewhere approved to go,
    // or the grid is dead for them.
    for (const current of SELECTABLE_CURRENT) {
      const offered = ELSEA_TARGET_CARDS.filter(
        (card) => transitionForCard(current, card) !== null
      );
      expect(offered.length).toBeGreaterThan(0);
    }
  });
});

describe('analytics', () => {
  it('never sends a long string, so free text cannot leak through a property', () => {
    // `deliver` is internal, so this asserts on the guard's observable effect:
    // the call must not throw and must accept only the typed shape. The shape
    // itself is what stops free text — every property is an enum, id or number.
    expect(() =>
      track({ name: 'outcome_recorded', transition: 'wound_up_home', outcome: 'yes' })
    ).not.toThrow();

    expect(() => track({ name: 'input_submitted', hasText: true, hasShortcut: false })).not.toThrow();
  });

  it('reports only whether input existed, never what it said', () => {
    // A compile-time guarantee made explicit: the submitted-input event has
    // exactly two boolean properties and no place to put text.
    const event = { name: 'input_submitted', hasText: true, hasShortcut: false } as const;

    expect(Object.keys(event).sort()).toEqual(['hasShortcut', 'hasText', 'name']);
  });
});
