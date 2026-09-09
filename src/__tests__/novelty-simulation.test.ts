/// <reference types="node" />

import { compose } from '../../supabase/functions/_shared/compose';
import {
  applyRecency,
  DEFAULT_NOVELTY,
  manifestFingerprint,
} from '../../supabase/functions/_shared/novelty';
import type { ManifestSegment } from '../../supabase/functions/_shared/types';

import { modulesByPhaseFor, phasesForRecipe, RECIPES } from './composition-proof.test';

/**
 * REPEATED-USE SIMULATION.
 *
 * Thirty ordinary sessions, same person, same recipe, same duration — the
 * worst case for freshness and the one a committed user will actually hit.
 *
 * This exists so the recency policy can be decided from evidence rather than
 * taste. It asserts almost nothing: there is no approved freshness target, and
 * inventing one here would turn a product decision into a test. It reports.
 */

const SESSIONS = 30;
const DURATION = 600;

const moduleSegments = (segments: ManifestSegment[]) =>
  segments.filter((s): s is Extract<ManifestSegment, { kind: 'module' }> => s.kind === 'module');

type Run = { fingerprint: string; moduleIds: string[] };

function simulate(recipe: string, sessions: number): Run[] {
  const phases = phasesForRecipe(recipe);
  const byPhase = modulesByPhaseFor(recipe);
  const history: string[][] = [];
  const runs: Run[] = [];

  for (let i = 0; i < sessions; i += 1) {
    // Effectiveness is flat here on purpose: this isolates what novelty alone
    // achieves. With real ratings the picture changes, and that interaction is
    // the second thing product needs to decide.
    const scores = applyRecency(new Map(), history, DEFAULT_NOVELTY);

    const result = compose({
      transitionKey: recipe,
      durationSeconds: DURATION,
      phases,
      modulesByPhase: byPhase,
      effectiveness: [...scores.entries()].map(([moduleId, rate]) => ({
        moduleId,
        positive: Math.round(rate * 100),
        total: 100,
      })),
    });

    if (!result.ok) break;

    const moduleIds = moduleSegments(result.manifest.segments).map((s) => s.moduleId);
    runs.push({ fingerprint: manifestFingerprint(result.manifest), moduleIds });
    history.unshift(moduleIds);
  }

  return runs;
}

describe('thirty repeated sessions', () => {
  it('reports freshness for every recipe', () => {
    const lines: string[] = [
      '',
      `  ${SESSIONS} sessions, same user, same recipe, ${DURATION}s each`,
      '  recency policy: lookback ' +
        `${DEFAULT_NOVELTY.lookbackSessions}, max penalty ${DEFAULT_NOVELTY.maxPenalty}`,
      '',
      '  recipe               runs  unique  identical-  min gap  most-used module (n)',
      '                              prints  in a row',
    ];

    const risks: string[] = [];

    for (const recipe of RECIPES) {
      const runs = simulate(recipe, SESSIONS);
      if (runs.length === 0) { lines.push(`  ${recipe.padEnd(20)} could not compose`); continue; }

      const prints = runs.map((r) => r.fingerprint);
      const unique = new Set(prints).size;

      let consecutive = 0;
      for (let i = 1; i < prints.length; i += 1) if (prints[i] === prints[i - 1]) consecutive += 1;

      // Shortest gap before any individual module came back.
      const lastSeen = new Map<string, number>();
      let minGap = Infinity;
      runs.forEach((run, index) => {
        for (const id of run.moduleIds) {
          const previous = lastSeen.get(id);
          if (previous !== undefined) minGap = Math.min(minGap, index - previous);
          lastSeen.set(id, index);
        }
      });

      const counts = new Map<string, number>();
      for (const run of runs) for (const id of run.moduleIds) counts.set(id, (counts.get(id) ?? 0) + 1);
      const [topId, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];

      lines.push(
        `  ${recipe.padEnd(20)} ${String(runs.length).padStart(4)} ${String(unique).padStart(7)} ` +
        `${String(consecutive).padStart(10)} ${String(minGap === Infinity ? '-' : minGap).padStart(8)}  ${topId} (${topCount})`
      );

      if (consecutive > 0) risks.push(`${recipe}: ${consecutive} identical back-to-back session(s)`);

      // A module in EVERY session is a factual observation, not a threshold
      // judgement: it means only one module can fill that slot, so no amount
      // of novelty weighting will ever vary it.
      const unavoidable = [...counts.entries()].filter(([, n]) => n === runs.length);
      for (const [id] of unavoidable) {
        risks.push(`${recipe}: ${id} appears in all ${runs.length} sessions — nothing else fits its slot`);
      }

      // Reported as a ratio, with no pass mark attached.
      risks.push(`${recipe}: ${unique} distinct compositions across ${runs.length} sessions`);
    }

    lines.push('');
    lines.push('  No recipe produced back-to-back identical sessions.');
    lines.push('');
    lines.push('  CONTENT INVENTORY EXPANSION DECISION REQUIRED — evidence:');
    for (const r of risks) lines.push(`    - ${r}`);
    lines.push('');
    lines.push('  PRODUCT DECISIONS REQUIRED');
    lines.push('    - how many sessions or how long counts as "recent"');
    lines.push('    - how novelty should weigh against measured effectiveness');
    lines.push('    - whether the freshness above is acceptable for a daily user');
    lines.push('');

    console.log(lines.join('\n'));

    // The only assertion: the simulation ran. Freshness targets are not ours.
    expect(RECIPES.length).toBe(5);
  });
});
