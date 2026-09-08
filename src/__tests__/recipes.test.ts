/// <reference types="node" />
//
// Node types are referenced HERE rather than added to `tsconfig.json`'s
// `types` array. Widening that would make Node globals visible to the whole
// project, including React Native code where `process` and `fs` do not exist —
// tsc would then happily accept a call that crashes on a device. This test
// legitimately reads a file from disk; nothing else should.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { MODULE_FAMILIES } from '../../supabase/functions/_shared/allocate';
import { TRANSITION_KEYS } from '@/types/elsea';

/**
 * The five recipe structures, and the boundary that keeps them private.
 *
 * These read the migration itself rather than a copy in TypeScript. A second
 * copy of the recipes would be a second thing to keep in step, and the
 * database is the one that decides what a session actually is.
 *
 * What this guards against is a recipe that looks fine in a table but cannot
 * produce a session: floors that add up past five minutes, or ceilings that
 * cannot reach twenty. Neither is visible by reading the rows.
 */

const MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations');

const SQL = readdirSync(MIGRATIONS)
  .filter((f) => f.includes('protect_recipes_and_seed_p19'))
  .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join('\n');

/**
 * The approved vocabulary, imported from the shared module rather than
 * restated. A second copy would be a second thing to keep in step, and this
 * test exists precisely to catch that class of drift.
 */
const FAMILIES: readonly string[] = MODULE_FAMILIES;

type Phase = {
  transition: string;
  ordinal: number;
  phase: string;
  min: number;
  max: number;
  provisional: boolean;
};

function block(table: string): string {
  const start = SQL.indexOf(`insert into ${table}`);
  if (start < 0) return '';
  const end = SQL.indexOf('on conflict', start);
  return SQL.slice(start, end < 0 ? undefined : end);
}

const PHASES: Phase[] = [
  ...block('recipe_phases').matchAll(
    /\(\s*'([a-z_]+)',\s*(\d+),\s*'([a-z_]+)',\s*(\d+),\s*(\d+),\s*(true|false)\s*\)/g
  ),
].map((m) => ({
  transition: m[1],
  ordinal: Number(m[2]),
  phase: m[3],
  min: Number(m[4]),
  max: Number(m[5]),
  provisional: m[6] === 'true',
}));

const ELIGIBILITY = [
  ...block('recipe_phase_families').matchAll(/\(\s*'([a-z_]+)',\s*'([a-z_]+)',\s*'([a-z]+)'\s*\)/g),
].map((m) => ({ transition: m[1], phase: m[2], family: m[3] }));

const forTransition = (key: string) =>
  PHASES.filter((p) => p.transition === key).sort((a, b) => a.ordinal - b.ordinal);

describe('the five recipes are seeded', () => {
  it('covers every canonical transition and nothing else', () => {
    const seeded = new Set(PHASES.map((p) => p.transition));

    expect([...seeded].sort()).toEqual([...TRANSITION_KEYS].sort());
  });

  it('numbers phases from zero with no gaps', () => {
    for (const key of TRANSITION_KEYS) {
      const ordinals = forTransition(key).map((p) => p.ordinal);
      expect(ordinals).toEqual(ordinals.map((_, i) => i));
    }
  });

  it('opens with arrive and closes with close', () => {
    for (const key of TRANSITION_KEYS) {
      const phases = forTransition(key);
      expect(phases[0].phase).toBe('arrive');
      expect(phases[phases.length - 1].phase).toBe('close');
    }
  });

  it('keeps every floor provisional pending clinical review', () => {
    // S14. A provisional number that quietly becomes settled is the failure
    // this flag exists to prevent, so it is asserted rather than trusted.
    for (const phase of PHASES) {
      expect(phase.provisional).toBe(true);
    }
  });

  it('gives every band a sane shape', () => {
    for (const phase of PHASES) {
      expect(phase.min).toBeGreaterThan(0);
      expect(phase.max).toBeGreaterThanOrEqual(phase.min);
    }
  });
});

describe('every recipe can actually produce the approved durations', () => {
  // The requirement that is invisible from reading the table: floors must fit
  // inside the shortest session, and ceilings must reach the longest.
  const APPROVED = [300, 600, 900, 1200];

  it('fits its floors inside a five minute session', () => {
    for (const key of TRANSITION_KEYS) {
      const floor = forTransition(key).reduce((sum, p) => sum + p.min, 0);
      expect(floor).toBeLessThanOrEqual(APPROVED[0]);
    }
  });

  it('reaches twenty minutes without exceeding any ceiling', () => {
    for (const key of TRANSITION_KEYS) {
      const ceiling = forTransition(key).reduce((sum, p) => sum + p.max, 0);
      expect(ceiling).toBeGreaterThanOrEqual(APPROVED[APPROVED.length - 1]);
    }
  });

  it('spans every approved duration', () => {
    for (const key of TRANSITION_KEYS) {
      const phases = forTransition(key);
      const floor = phases.reduce((sum, p) => sum + p.min, 0);
      const ceiling = phases.reduce((sum, p) => sum + p.max, 0);

      for (const duration of APPROVED) {
        expect(floor).toBeLessThanOrEqual(duration);
        expect(ceiling).toBeGreaterThanOrEqual(duration);
      }
    }
  });
});

describe('the seeded row counts are what the handover claims', () => {
  it('seeds exactly 31 phase rows and 53 eligibility rows', () => {
    // Pinned because these numbers are quoted in docs/ELSEA.md, and a
    // handover that miscounts its own contents is worse than one that stays
    // silent. This caught the first draft claiming 56.
    expect(PHASES).toHaveLength(31);
    expect(ELIGIBILITY).toHaveLength(53);
  });

  it('matches the per-recipe phase counts', () => {
    const counts = Object.fromEntries(
      TRANSITION_KEYS.map((key) => [key, forTransition(key).length])
    );

    expect(counts).toEqual({
      wound_up_home: 6,
      scattered_focused: 6,
      nervous_ready: 6,
      wired_sleep: 6,
      flat_go: 7,
    });
  });
});

describe('family eligibility', () => {
  it('uses only the twelve approved families, in canonical lower case', () => {
    for (const row of ELIGIBILITY) {
      expect(FAMILIES).toContain(row.family);
    }
  });

  it('gives every phase at least one eligible family', () => {
    // A phase nothing is eligible for can never be filled, so the recipe
    // would fail at composition rather than at seed time.
    for (const phase of PHASES) {
      const eligible = ELIGIBILITY.filter(
        (e) => e.transition === phase.transition && e.phase === phase.phase
      );
      expect(eligible.length).toBeGreaterThan(0);
    }
  });

  it('names only phases that exist', () => {
    for (const row of ELIGIBILITY) {
      const known = PHASES.some((p) => p.transition === row.transition && p.phase === row.phase);
      expect(known).toBe(true);
    }
  });

  it('opens on orient and closes on close in every recipe', () => {
    for (const key of TRANSITION_KEYS) {
      const arrive = ELIGIBILITY.filter((e) => e.transition === key && e.phase === 'arrive');
      const close = ELIGIBILITY.filter((e) => e.transition === key && e.phase === 'close');

      expect(arrive.map((e) => e.family)).toContain('orient');
      expect(close.map((e) => e.family)).toContain('close');
    }
  });
});

describe('the proprietary tables stay off the client', () => {
  const PROPRIETARY = [
    'recipe_phases',
    'recipe_phase_families',
    'intervention_modules',
  ];

  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) sources.push(path);
    }
  };
  walk(join(__dirname, '..'));

  it('never queries a proprietary table from application code', () => {
    // The security boundary, as a regression test. These tables hold the five
    // recipes and their eligibility rules, and are service-role only. A client
    // query would return nothing and look merely broken, so the mistake would
    // be easy to make and hard to spot.
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const table of PROPRIETARY) {
        expect(text).not.toContain(`.from('${table}')`);
        expect(text).not.toContain(`.from("${table}")`);
      }
    }
  });

  it('composes through the server-side function instead', () => {
    const composition = readFileSync(join(__dirname, '..', 'lib', 'composition.ts'), 'utf8');

    expect(composition).toContain("functions.invoke");
    expect(composition).toContain("'compose'");
  });
});
