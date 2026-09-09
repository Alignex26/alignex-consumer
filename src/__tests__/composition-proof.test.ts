/// <reference types="node" />
//
// Node types are referenced here, not added to `tsconfig.json`'s `types`,
// because only tests legitimately read files from disk.

import { readFileSync } from 'fs';
import { join } from 'path';

import { compose } from '../../supabase/functions/_shared/compose';
import type {
  InterventionModule,
  ManifestSegment,
  RecipePhase,
} from '../../supabase/functions/_shared/types';

/**
 * THE V1 COMPOSITION PROOF.
 *
 * Every recipe at every approved duration — five by four, twenty cases — run
 * through the real allocator against the proposed V1 inventory. This is both
 * the evidence behind `module-inventory-v1.md` and the regression guard on it:
 * a change to the allocator, the recipes or the inventory that breaks any of
 * the twenty fails here.
 *
 * The recipes are read from the applied migration rather than restated, so the
 * database stays the single source of truth for phase order, bands and family
 * eligibility.
 *
 * THE INVENTORY BELOW IS METADATA ONLY. Durations, families and keys — no
 * technique, no script, no clinical content of any kind. Every slot is
 * CONTENT AUTHORING REQUIRED.
 */

const MIGRATION = join(
  __dirname, '..', '..', 'supabase', 'migrations',
  '20260908150000_protect_recipes_and_seed_p19.sql'
);
const SQL = readFileSync(MIGRATION, 'utf8');
const block = (t: string) =>
  SQL.slice(SQL.indexOf(`insert into ${t}`), SQL.indexOf('on conflict', SQL.indexOf(`insert into ${t}`)));

type PhaseRow = { recipe: string; ordinal: number; phase: string; min: number; max: number };

const PHASES: PhaseRow[] = [
  ...block('recipe_phases').matchAll(
    /\(\s*'([a-z_]+)',\s*(\d+),\s*'([a-z_]+)',\s*(\d+),\s*(\d+),\s*true\s*\)/g
  ),
].map((m) => ({ recipe: m[1], ordinal: +m[2], phase: m[3], min: +m[4], max: +m[5] }));

const ELIGIBILITY = [
  ...block('recipe_phase_families').matchAll(
    /\(\s*'([a-z_]+)',\s*'([a-z_]+)',\s*'([a-z]+)'\s*\)/g
  ),
].map((m) => ({ recipe: m[1], phase: m[2], family: m[3] }));

export const RECIPES = [...new Set(PHASES.map((p) => p.recipe))].sort();
export const DURATIONS = [300, 600, 900, 1200];

/**
 * The proposed V1 inventory, as metadata.
 *
 * `[family, seconds]`. Sizes are driven by the tightest slot any recipe gives
 * that family — a module longer than its slot is silently unselectable, which
 * is how a recipe comes to have no valid composition at five minutes.
 */
const INVENTORY: [string, number][] = [
  // orient — arrive is 21-23s at 300s in every recipe, so the short one is tiny.
  ['orient', 20], ['orient', 30], ['orient', 45],
  // close — wired_sleep allocates 11s, the tightest slot anywhere.
  ['close', 10], ['close', 16], ['close', 25],
  // regulate
  ['regulate', 45], ['regulate', 90], ['regulate', 140], ['regulate', 200],
  // ground
  ['ground', 40], ['ground', 85], ['ground', 130], ['ground', 190],
  // release
  ['release', 45], ['release', 95], ['release', 145], ['release', 200],
  // reframe
  ['reframe', 40], ['reframe', 85], ['reframe', 130], ['reframe', 180],
  // focus
  ['focus', 40], ['focus', 80], ['focus', 130], ['focus', 190],
  // activate — flat_go makes it eligible in THREE phases (wake_body,
  // raise_energy, build_momentum), so with no-repeat it needs two short
  // variants or `build_momentum` starves at 300s.
  ['activate', 45], ['activate', 65], ['activate', 85], ['activate', 130], ['activate', 185],
  // prepare — same pressure from `choose_first_move` and `build_momentum`.
  ['prepare', 45], ['prepare', 65], ['prepare', 85], ['prepare', 130], ['prepare', 185],
  // transition
  ['transition', 55], ['transition', 100], ['transition', 150],
  // settle
  ['settle', 40], ['settle', 85], ['settle', 130], ['settle', 190],
  // sleep — also eligible in wired_sleep's 11s close, so one must be tiny.
  ['sleep', 10], ['sleep', 90], ['sleep', 150], ['sleep', 200],
];

export const LIBRARY: InterventionModule[] = INVENTORY.map(([family, seconds]) => ({
  id: `${family}_${seconds}s`,
  moduleKey: `${family}_${seconds}s`,
  family: family as InterventionModule['family'],
  // CONTENT AUTHORING REQUIRED. Placeholder, never a real technique name.
  techniqueKey: 'CONTENT_AUTHORING_REQUIRED',
  storagePath: `modules/${family}_${seconds}s.m4a`,
  durationSeconds: seconds,
  intensity: 5,
  requiresHeadphones: false,
  isBed: false,
}));

export function phasesForRecipe(recipe: string): RecipePhase[] {
  return PHASES.filter((p) => p.recipe === recipe)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((p) => ({
      transitionKey: p.recipe,
      ordinal: p.ordinal,
      phase: p.phase,
      minSeconds: p.min,
      maxSeconds: p.max,
      isProvisional: true,
    }));
}

export function modulesByPhaseFor(
  recipe: string,
  library: InterventionModule[] = LIBRARY
): Record<string, InterventionModule[]> {
  const out: Record<string, InterventionModule[]> = {};
  for (const p of phasesForRecipe(recipe)) {
    const families = ELIGIBILITY.filter((e) => e.recipe === recipe && e.phase === p.phase)
      .map((e) => e.family);
    out[p.phase] = library.filter((m) => families.includes(m.family));
  }
  return out;
}

export function composeFor(recipe: string, seconds: number, library = LIBRARY) {
  return compose({
    transitionKey: recipe,
    durationSeconds: seconds,
    phases: phasesForRecipe(recipe),
    modulesByPhase: modulesByPhaseFor(recipe, library),
  });
}

const moduleSegments = (segments: ManifestSegment[]) =>
  segments.filter((s): s is Extract<ManifestSegment, { kind: 'module' }> => s.kind === 'module');

describe('all twenty recipe/duration cases compose', () => {
  for (const recipe of RECIPES) {
    for (const seconds of DURATIONS) {
      it(`${recipe} @ ${seconds}s`, () => {
        const result = composeFor(recipe, seconds);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(`${recipe} @ ${seconds}s failed: ${result.failure}`);

        const { manifest } = result;
        const modules = moduleSegments(manifest.segments);

        // No module plays twice in a session. The locked rule.
        const ids = modules.map((m) => m.moduleId);
        expect(new Set(ids).size).toBe(ids.length);

        // Every phase stayed inside its approved band.
        for (const phase of phasesForRecipe(recipe)) {
          const spent = manifest.segments
            .filter((s) => s.kind !== 'generated' && s.phase === phase.phase)
            .reduce((n, s) => n + s.durationSeconds, 0);
          expect(spent).toBeGreaterThanOrEqual(phase.minSeconds);
          expect(spent).toBeLessThanOrEqual(phase.maxSeconds);
        }

        // The timeline is contiguous and adds up.
        const total = manifest.segments
          .filter((s) => s.layer === 'foreground')
          .reduce((n, s) => n + s.durationSeconds, 0);
        expect(total).toBe(manifest.durationSeconds);
      });
    }
  }
});

describe('the no-repeat rule is session-level, not phase-level', () => {
  it('never selects the same module in two phases', () => {
    // The rule that changed. A module eligible in two phases used to be
    // selectable in both, so a person heard the same material twice.
    for (const recipe of RECIPES) {
      for (const seconds of DURATIONS) {
        const result = composeFor(recipe, seconds);
        if (!result.ok) throw new Error('unreachable');
        const ids = moduleSegments(result.manifest.segments).map((m) => m.moduleId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('fails explicitly when unique inventory runs out', () => {
    // One module, two phases needing it. Rather than replay it, composition
    // fails — the library is too thin and says so.
    const single = LIBRARY.filter((m) => m.family === 'orient' && m.durationSeconds === 20);
    const thin = [...LIBRARY.filter((m) => m.family !== 'orient'), ...single];

    // `wound_up_home` reaches `transition` in two phases; strip it to one.
    const oneTransition = thin.filter(
      (m) => m.family !== 'transition' || m.durationSeconds === 55
    );
    const noGroundOrSettle = oneTransition.filter(
      (m) => m.family !== 'ground' && m.family !== 'settle'
    );

    const result = composeFor('wound_up_home', 300, noGroundOrSettle);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBe('phase_unfilled');
  });

  it('does not shorten the session to hide thin inventory', () => {
    // The allocation is fixed before selection starts, so a shortfall shows up
    // as silence inside the phase, never as a shorter session.
    const sparse = LIBRARY.filter((m) => m.durationSeconds <= 45);
    const result = composeFor('nervous_ready', 1200, sparse);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.manifest.durationSeconds).toBe(1200);

    const silence = result.manifest.segments
      .filter((s) => s.kind === 'silence')
      .reduce((n, s) => n + s.durationSeconds, 0);
    expect(silence).toBeGreaterThan(0);
  });
});
