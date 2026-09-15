/// <reference types="node" />

import { fillPhase, planPhases } from '../../supabase/functions/_shared/allocate';
import type { PlanModule, PlanPhase } from '../../supabase/functions/_shared/allocate';

/**
 * THE RESERVATION RULE.
 *
 * Chaining is what lets a phase use its whole allocation. It is also what let an
 * early phase drain a pool a later phase depended on.
 *
 * `wound_up_home` at 1200s failed exactly this way: `reconnect_to_now` is
 * allocated 346 seconds and accepts `ground`, `transition` and `settle`. It
 * chained through the shared pool and the `settle` phase immediately after it
 * found nothing left. Nine of sixty combinations failed for this one reason, and
 * fifteen further modules would have been needed to out-supply it — 45 provider
 * generations of content whose only job was to survive being eaten.
 *
 * A phase now takes its FIRST module unconditionally and takes extras only while
 * every later phase can still be filled.
 *
 * WHAT THIS IS NOT. It is one look forward, in phase order, giving each
 * remaining phase the module `pick` would actually choose. Not a search, not
 * backtracking, not a maximum matching — a matching would promise assignments
 * the greedy allocator will never make, which is the precise mistake that once
 * had a planning tool reporting 5/5 while the composer managed 27/60.
 */

const phase = (over: Partial<PlanPhase>): PlanPhase => ({
  phase: 'p',
  minSeconds: 60,
  maxSeconds: 60,
  ...over,
});

const mod = (id: string, durationSeconds: number): PlanModule => ({
  id,
  moduleKey: id,
  storagePath: `modules/${id}.m4a`,
  durationSeconds,
});

const NO_SCORES = new Map<string, number>();

/**
 * The shape of the real failure, reduced.
 *
 * `wide` is allocated generously and accepts both families. `narrow` runs after
 * it and accepts only the second. Greedily, `wide` eats both and `narrow`
 * starves.
 */
const WIDE_THEN_NARROW = [
  phase({ phase: 'wide', minSeconds: 100, maxSeconds: 100 }),
  phase({ phase: 'narrow', minSeconds: 40, maxSeconds: 40 }),
];
const LIBRARY: Record<string, PlanModule[]> = {
  wide: [mod('a', 40), mod('b', 40)],
  narrow: [mod('b', 40)],
};
const byPhase = (p: string) => LIBRARY[p] ?? [];

describe('a phase does not starve the one after it', () => {
  it('composes where the greedy rule failed', () => {
    const plan = planPhases(WIDE_THEN_NARROW, byPhase, NO_SCORES, 140);
    expect(plan.ok).toBe(true);
  });

  it('the earlier phase gives up its second module, not its first', () => {
    const plan = planPhases(WIDE_THEN_NARROW, byPhase, NO_SCORES, 140);
    if (!plan.ok) throw new Error('expected a plan');
    const chosen = plan.segments.filter((s) => s.kind === 'module');
    expect(chosen).toHaveLength(2);
    expect(chosen.map((s) => (s as { module: PlanModule }).module.id)).toEqual(['a', 'b']);
  });

  it('the unused allocation becomes silence, not a shorter session', () => {
    const plan = planPhases(WIDE_THEN_NARROW, byPhase, NO_SCORES, 140);
    if (!plan.ok) throw new Error('expected a plan');
    expect(plan.totalSeconds).toBe(140);
    expect(plan.segments.some((s) => s.kind === 'silence')).toBe(true);
  });
});

describe('a phase still gets its first module whatever the cost', () => {
  it('takes it even when that leaves a later phase unfillable', () => {
    // Reserving against the FIRST module would mean a phase declining to be
    // filled at all, which helps nobody: the composition fails either way, and
    // failing earlier is not better.
    const single: Record<string, PlanModule[]> = { wide: [mod('only', 40)], narrow: [mod('only', 40)] };
    const plan = planPhases(WIDE_THEN_NARROW, (p) => single[p] ?? [], NO_SCORES, 140);
    expect(plan.ok).toBe(false);
    if (plan.ok) throw new Error('unreachable');
    expect(plan.failure).toBe('phase_unfilled');
  });
});

describe('nothing that already worked changed', () => {
  it('a phase with no downstream competition still chains freely', () => {
    const phases = [
      phase({ phase: 'wide', minSeconds: 100, maxSeconds: 100 }),
      phase({ phase: 'narrow', minSeconds: 40, maxSeconds: 40 }),
    ];
    const plenty: Record<string, PlanModule[]> = {
      wide: [mod('a', 40), mod('b', 40)],
      narrow: [mod('c', 40)],
    };
    const plan = planPhases(phases, (p) => plenty[p] ?? [], NO_SCORES, 140);
    if (!plan.ok) throw new Error('expected a plan');
    // `wide` takes both, because `narrow` has its own module and is not at risk.
    expect(plan.segments.filter((s) => s.kind === 'module')).toHaveLength(3);
  });

  it('the last phase is never reserved against — there is nothing after it', () => {
    const phases = [phase({ phase: 'wide', minSeconds: 100, maxSeconds: 100 })];
    const plan = planPhases(phases, () => [mod('a', 40), mod('b', 40)], NO_SCORES, 100);
    if (!plan.ok) throw new Error('expected a plan');
    expect(plan.segments.filter((s) => s.kind === 'module')).toHaveLength(2);
  });
});

describe('fillPhase on its own is unchanged', () => {
  it('defaults to permissive, so existing callers behave identically', () => {
    const used = new Set<string>();
    const chosen = fillPhase([mod('a', 40), mod('b', 40)], 100, NO_SCORES, used);
    expect(chosen).toHaveLength(2);
    expect(used.size).toBe(2);
  });

  it('honours a guard that refuses extras', () => {
    const chosen = fillPhase([mod('a', 40), mod('b', 40)], 100, NO_SCORES, new Set(), () => false);
    expect(chosen).toHaveLength(1);
  });

  it('the guard never blocks the first module', () => {
    const chosen = fillPhase([mod('a', 40)], 100, NO_SCORES, new Set(), () => false);
    expect(chosen).toHaveLength(1);
  });
});

describe('the allocator stayed legible', () => {
  it('no backtracking, no undo, no re-ordering of phases', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'supabase', 'functions', '_shared', 'allocate.ts'),
      'utf8'
    ) as string;
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('backtrack');
    expect(code).not.toContain('.reverse()');
    expect(code).not.toContain('permutation');
    // The look-ahead uses the same `pick` the real run uses.
    expect(source).toContain('ONE LOOK FORWARD, NO SEARCH');
  });

  it('still refuses to repeat a module within a session', () => {
    const phases = [
      phase({ phase: 'wide', minSeconds: 100, maxSeconds: 100 }),
      phase({ phase: 'narrow', minSeconds: 40, maxSeconds: 40 }),
    ];
    const plan = planPhases(phases, () => [mod('a', 40), mod('b', 40)], NO_SCORES, 140);
    if (!plan.ok) throw new Error('expected a plan');
    const ids = plan.segments
      .filter((s) => s.kind === 'module')
      .map((s) => (s as { module: PlanModule }).module.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
