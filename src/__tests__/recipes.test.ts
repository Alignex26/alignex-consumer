/// <reference types="node" />
//
// Node types are referenced HERE rather than added to `tsconfig.json`'s
// `types` array. Widening that would make Node globals visible to the whole
// project, including React Native code where `process` and `fs` do not exist —
// tsc would then happily accept a call that crashes on a device. This test
// legitimately reads a file from disk; nothing else should.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { MODULE_FAMILIES } from '../../supabase/functions/_shared/types';
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

/**
 * Every `import`/`export ... from '..._shared...'` statement, whole.
 *
 * Matched as a STATEMENT rather than a line: a multi-line
 * `export type { A, B } from '...'` ends on a line that mentions
 * `_shared` but does not start with `export type`, which a line-based
 * check reads as a violation. It found exactly that on the first run.
 */
const SHARED_STATEMENT = /(?:import|export)[\s\S]*?from\s*['\"][^'\"]*_shared[^'\"]*['\"]/g;

/** `import type` / `export type` are erased by babel and ship nothing. */
const TYPE_ONLY = /^(?:import|export)\s+type\b/;

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

  it('never imports the decision engine into client code', () => {
    // THE RUNTIME BOUNDARY. The allocator, the selection rules, the recipes
    // vocabulary and the speech budget all live server-side and must not ship
    // to a device. A `import type` is fine — babel erases it and nothing is
    // bundled — but a value import would silently pull the whole engine in.
    //
    // This is not hypothetical: `src/types/session-engine.ts` briefly carried
    // `export { MODULE_FAMILIES }`, a value re-export, and only escaped
    // shipping because every production importer happened to use `import
    // type`. One ordinary import in a screen would have shipped it.
    const production = sources.filter((f) => !f.includes('__tests__'));

    for (const file of production) {
      const source = readFileSync(file, 'utf8');

      for (const statement of source.match(SHARED_STATEMENT) ?? []) {
        const collapsed = statement.replace(/\s+/g, ' ').trim();

        // The offending statement is named in the failure, so it is
        // obvious rather than hunted for.
        expect(`${file}: ${TYPE_ONLY.test(collapsed) ? 'ok' : collapsed}`).toBe(
          `${file}: ok`
        );
      }
    }
  });

  it('composes through the server-side function instead', () => {
    const composition = readFileSync(join(__dirname, '..', 'lib', 'composition.ts'), 'utf8');

    expect(composition).toContain("functions.invoke");
    expect(composition).toContain("'compose'");
  });
});

describe('the edge functions import only names that exist', () => {
  // WHY THIS EXISTS. `tsconfig.json` excludes `supabase/`, and nothing under
  // `src/` imports an Edge Function, so tsc never typechecks one. A named
  // import that does not exist is therefore invisible until Deno refuses to
  // boot the deployed function — which is exactly what happened:
  // `compose/index.ts` imported `BUDGET_NORMAL_SECONDS` from `speech.ts`,
  // where it did not exist, and the deploy succeeded while the function
  // returned BOOT_ERROR to every caller.
  //
  // This resolves every relative import in the functions tree against the
  // exports of the file it names. It is not a typechecker, but it catches the
  // one class of error that reaches production silently.
  const FUNCTIONS = join(__dirname, '..', '..', 'supabase', 'functions');

  const sourcesIn = (dir: string): string[] => {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) found.push(...sourcesIn(path));
      else if (entry.name.endsWith('.ts')) found.push(path);
    }
    return found;
  };

  const NAMED_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](\.[^'"]*)['"]/g;
  const EXPORTED = /export\s+(?:const|function|type|class|interface|enum)\s+(\w+)/g;
  const RE_EXPORTED = /export\s*\{([^}]*)\}/g;

  it('resolves every named import to a real export', () => {
    for (const file of sourcesIn(FUNCTIONS)) {
      const source = readFileSync(file, 'utf8');

      for (const match of source.matchAll(NAMED_IMPORT)) {
        const names = match[1]
          .split(',')
          .map((n) => n.replace(/\btype\b/, '').trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean);

        const target = join(file, '..', match[2]);
        const targetSource = readFileSync(target, 'utf8');

        const exported = new Set<string>();
        for (const e of targetSource.matchAll(EXPORTED)) exported.add(e[1]);
        for (const e of targetSource.matchAll(RE_EXPORTED)) {
          for (const n of e[1].split(',')) {
            const clean = n.replace(/\btype\b/, '').trim().split(/\s+as\s+/).pop();
            if (clean) exported.add(clean.trim());
          }
        }

        for (const name of names) {
          expect(`${match[2]} exports ${name}: ${exported.has(name)}`).toBe(
            `${match[2]} exports ${name}: true`
          );
        }
      }
    }
  });
});
