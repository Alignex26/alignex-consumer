/// <reference types="node" />

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

/**
 * LIBRARY PLANNING.
 *
 * This tool decides where provider money is spent, so the property that matters
 * is not that it produces a number — it is that it CANNOT produce one when it
 * has no right to.
 *
 * The tool it replaces could. It validated against a hardcoded snapshot of a
 * ten-module library, kept passing after the library grew to seventeen, reported
 * 30/60 where the composer said 27/60, and presented a joint optimum as a work
 * list. The first row of that list was commissioned: 21 provider calls, zero
 * coverage gain.
 *
 * Every test here exists because of a specific way that went wrong.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const PLANNER = read('scripts', 'plan-library.mjs');
const SIM = read('scripts', 'lib', 'planning.mjs');
const LIB = pathToFileURL(join(root, 'scripts', 'lib', 'planning.mjs')).href;

const TAG = '__ELSEA_JSON__';
function run<T>(body: string): T {
  const source = `import * as P from ${JSON.stringify(LIB)};\n${body}`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.startsWith(TAG));
  if (line === undefined) throw new Error(`no ${TAG} in output:\n${out}`);
  return JSON.parse(line.slice(TAG.length)) as T;
}
const emit = (expr: string) => `console.log(${JSON.stringify(TAG)} + JSON.stringify(${expr}));`;

/** A recipe shaped like a real one: two phases, the second fussier. */
const RECIPE = `[
  { phase: 'a', min: 60, max: 120, families: ['x'] },
  { phase: 'b', min: 60, max: 120, families: ['x', 'y'] },
]`;

describe('it cannot validate against a library that no longer exists', () => {
  it('derives its baseline from live compose calls, every run', () => {
    expect(PLANNER).toContain('functions/v1/compose');
    expect(PLANNER).toContain('Establishing the baseline from the live composer');
  });

  it('holds no hardcoded expectation of current coverage', () => {
    // The previous tool carried a GROUND_TRUTH table pinned to a ten-module
    // library. It kept passing after the library changed, because it was
    // checking facts rather than reality.
    const code = codeOnly(PLANNER);
    expect(code).not.toContain('GROUND_TRUTH');
    expect(code).not.toMatch(/nervous_ready:\s*\{/);
    expect(code).not.toMatch(/\b300:\s*(true|false)/);
  });

  it('the superseded tool is gone rather than left runnable', () => {
    expect(() => read('scripts', 'library-sizing.mjs')).toThrow();
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts.sizing).toBeUndefined();
    expect(pkg.scripts.plan).toBe('node scripts/plan-library.mjs');
  });
});

describe('it fails closed rather than guessing', () => {
  it('refuses to plan without live credentials', () => {
    let code = 0;
    let output = '';
    try {
      output = execFileSync(process.execPath, [join(root, 'scripts', 'plan-library.mjs')], {
        encoding: 'utf8',
        env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
      });
    } catch (error) {
      const e = error as { status: number; stdout?: string; stderr?: string };
      code = e.status;
      output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
    expect(code).not.toBe(0);
    expect(output).toContain('PLANNING REFUSED');
    expect(output).toContain('will not fall back to a fixture');
  });

  it('produces no recommendation when the simulator disagrees with the composer', () => {
    const block = PLANNER.slice(PLANNER.indexOf('if (disagreements.length > 0)'));
    expect(block.slice(0, 700)).toContain('PLANNING REFUSED');
    expect(block.slice(0, 700)).toContain('process.exit(1)');
    // And the refusal happens before anything is recommended.
    const code = codeOnly(PLANNER);
    expect(code.indexOf('disagreements.length > 0')).toBeLessThan(code.indexOf('ORDERED ROADMAP'));
  });

  it('the disagreement check compares against the live result, not a constant', () => {
    expect(PLANNER).toContain('liveCases.filter((c, i) => c.ok !== simulated.cases[i].ok)');
  });
});

describe('duration variation changes composition, so the model must carry it', () => {
  it('two modules of different lengths do not behave as one length twice', () => {
    // The old model gave every hypothetical module in a family one duration.
    // This is the case that breaks: a phase floor of 60s fits one 55s module or
    // two 25s modules, and what remains for the NEXT phase differs.
    const result = run<{ long: string[] | null; short: string[] | null }>(`
      const long = P.planSession(${RECIPE}, new Map([['x', [
        { key: 'x1', duration: 55 }, { key: 'x2', duration: 55 },
      ]]]), 120);
      const short = P.planSession(${RECIPE}, new Map([['x', [
        { key: 's1', duration: 25 }, { key: 's2', duration: 25 },
      ]]]), 120);
      ${emit('{ long, short }')}
    `);
    // Same count, same families, different lengths -> different chaining.
    expect(result.long).not.toEqual(result.short);
  });

  it('a library of short modules can exhaust itself where longer ones would not', () => {
    const exhausted = run<boolean>(`
      // Three 20s modules: the first phase chains all three and the second
      // phase has nothing left.
      const shortOnly = P.composes(${RECIPE}, new Map([['x', [
        { key: 'a', duration: 20 }, { key: 'b', duration: 20 }, { key: 'c', duration: 20 },
      ]]]), 120);
      ${emit('shortOnly')}
    `);
    const survives = run<boolean>(`
      const longer = P.composes(${RECIPE}, new Map([['x', [
        { key: 'a', duration: 60 }, { key: 'b', duration: 60 },
      ]]]), 120);
      ${emit('longer')}
    `);
    expect(exhausted).toBe(false);
    expect(survives).toBe(true);
  });

  it('duration shapes are derived from recipe floors, not invented', () => {
    const shapes = run<{ duration: number }[]>(`
      ${emit(`P.durationShapesFor('x', new Map([['r', ${RECIPE}]]), [])`)}
    `);
    expect(shapes.length).toBeGreaterThan(0);
    for (const s of shapes) expect(s.duration).toBeLessThanOrEqual(60);
  });
});

describe('a joint optimum is never presented as independent steps', () => {
  it('the roadmap searches for the smallest batch that gains, not the first', () => {
    // Breadth-first over batch size: size 1 is exhausted before size 2 is tried.
    expect(PLANNER).toContain('for (let size = 1; size <= maxSize; size += 1)');
    expect(PLANNER).toContain('if (after > base) return');
  });

  it('a multi-module batch is labelled DEPENDENT', () => {
    expect(PLANNER).toContain('const dependent = found.batch.length > 1');
    expect(PLANNER).toContain('DEPENDENT BATCH — these only work together');
  });

  it('every step reports its own before, after and gain', () => {
    expect(PLANNER).toContain('found.before');
    expect(PLANNER).toContain('found.after');
    expect(PLANNER).toContain('gain +');
    expect(PLANNER).toContain('newly composable:');
  });

  it('and the cumulative cost in generations', () => {
    // Because each module is three ElevenLabs calls, and that is the number
    // that decides whether a batch is worth commissioning.
    expect(PLANNER).toContain('cumulative new modules');
    expect(PLANNER).toContain('generations');
  });

  it('zero-gain candidates are shown as zero, not omitted', () => {
    // Hiding them is how a joint optimum starts looking like a work list.
    expect(PLANNER).toContain("gain > 0 ? `+${gain * VOICE_COUNT}` : '0'");
  });
});

describe('planning never touches a provider', () => {
  it('neither file mentions a provider at all', () => {
    for (const source of [PLANNER, SIM]) {
      expect(source.toLowerCase()).not.toContain('elevenlabs');
      expect(source).not.toContain('generate-master');
      expect(source).not.toContain('API_KEY');
    }
  });

  it('and writes nothing', () => {
    const code = codeOnly(PLANNER);
    expect(code).not.toContain("method: 'PATCH'");
    expect(code).not.toContain("method: 'PUT'");
    expect(code).not.toContain("method: 'DELETE'");
    // The only POST is to compose, which reads.
    const posts = code.match(/method: 'POST'/g) ?? [];
    expect(posts).toHaveLength(1);
    expect(code).toContain('functions/v1/compose');
  });

  it('the simulator reaches nothing at all', () => {
    expect(codeOnly(SIM)).not.toContain('fetch');
    expect(codeOnly(SIM)).not.toContain('process.env');
  });
});

describe('the simulator is a model and says so', () => {
  it('states that it is not a second source of truth', () => {
    expect(SIM).toContain('IT IS NOT A SECOND SOURCE OF TRUTH');
    expect(SIM).toContain('fail closed');
  });

  it('names the allocator it must stay in step with', () => {
    expect(SIM).toContain('_shared/allocate.ts');
  });

  it('reproduces the allocator’s greedy chaining', () => {
    // Longest-first, no lookahead: an earlier phase can starve a later one.
    const starved = run<boolean>(`
      ${emit(`P.composes([
        { phase: 'a', min: 60, max: 60, families: ['x', 'y'] },
        { phase: 'b', min: 60, max: 60, families: ['y'] },
      ], new Map([['x', [{ key: 'x1', duration: 30 }]], ['y', [{ key: 'y1', duration: 55 }]]]), 120)`)}
    `);
    // Phase a takes the longer y1, leaving phase b with nothing.
    expect(starved).toBe(false);
  });
});
