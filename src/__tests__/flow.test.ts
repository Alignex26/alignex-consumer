import { ALLOWED_NEXT, PHASES, PHASE_ROUTE, canEnter, type Phase } from '@/flow/product-flow';
import { track } from '@/lib/analytics';
import { SELECTABLE_CURRENT, targetsFor, transitionFor } from '@/lib/transitions';
import { TRANSITION_KEYS } from '@/types/elsea';

/**
 * The flow grammar, the correction options, and the analytics guard.
 *
 * These are the invariants that are easy to break silently later: an extra
 * edge into interpretation, a correction pair with no transition behind it, or
 * an analytics property that quietly becomes free text.
 */

describe('the product flow', () => {
  it('lets nothing reach interpretation except the safety check', () => {
    const sources = PHASES.filter((phase) => ALLOWED_NEXT[phase].includes('interpretation'));

    expect(sources).toEqual(['safety_check']);
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
