// supabase/functions/_shared/allocate.ts
//
// THE ONE IMPLEMENTATION OF ELSEA'S ALLOCATION AND SELECTION ALGORITHM.
//
// SERVER-SIDE ONLY. There is one copy, and it never ships to a device.
//
// The production client does not import this, directly or transitively. It
// calls the `compose` Edge Function and receives a finished manifest, so the
// device holds no part of the decision engine — not the allocator, not the
// selection rules, not the budget. `src/__tests__/recipes.test.ts` fails if
// any file under `src/` imports `_shared` at runtime, and the check is a real
// one: this is exactly the kind of boundary that erodes by accident.
//
// Tests import it directly, which costs the client nothing because tests are
// not bundled.
//
// THE ONE RULE FOR THIS FILE: it must stay dependency-free. No React, no Expo,
// no Supabase client, no Deno globals, no Node globals, no path aliases — it
// has to load in Deno, where none of those exist.

/** Below this many rated runs, one opinion would decide a module's fate. */
export const MIN_SAMPLE = 3;

/** An unrated module is neither preferred nor penalised. */
export const NEUTRAL_SCORE = 0.5;

// The speech budget lives in `speech.ts`, with the rest of the speech code.

// The family vocabulary lives in `types.ts`, which owns the domain types.
export { MODULE_FAMILIES, type ModuleFamily } from './types.ts';

export type PlanPhase = {
  phase: string;
  minSeconds: number;
  maxSeconds: number;
};

export type PlanModule = {
  id: string;
  moduleKey: string;
  storagePath: string;
  durationSeconds: number;
};

export type PlanSegment = {
  kind: 'module' | 'silence';
  phase: string;
  offsetSeconds: number;
  durationSeconds: number;
  /** Present only on a module segment. */
  module?: PlanModule;
};

export type PlanFailure = 'duration_unreachable' | 'phase_unfilled';

export type Plan =
  | { ok: true; segments: PlanSegment[]; totalSeconds: number }
  | { ok: false; failure: PlanFailure };

/**
 * Allocates available seconds across phases.
 *
 * Every phase starts at its floor; the surplus is dealt out in proportion to
 * each phase's headroom AND CLAMPED TO IT. Without that clamp the whole
 * surplus lands in the first phase and runs it past its approved ceiling — a
 * regulation phase approved for at most 180s running for 290s. Once the floors
 * are clinical rather than provisional, that is a phase structure being
 * silently overridden by arithmetic.
 *
 * Any surplus left when every phase is at its ceiling is simply not allocated:
 * the session comes out shorter than requested, and the caller reports the
 * duration actually composed rather than the one asked for.
 */
export function allocate(phases: readonly PlanPhase[], available: number): number[] | null {
  const floors = phases.map((p) => p.minSeconds);
  const totalFloor = floors.reduce((a, b) => a + b, 0);
  if (available < totalFloor) return null;

  const headroom = phases.map((p) => p.maxSeconds - p.minSeconds);
  const totalHeadroom = headroom.reduce((a, b) => a + b, 0);
  let slack = available - totalFloor;
  if (totalHeadroom === 0 || slack === 0) return floors;

  const slackTotal = slack;
  const allocated = floors.slice();

  for (let i = 0; i < phases.length && slack > 0; i += 1) {
    const proportional = Math.round((headroom[i] / totalHeadroom) * slackTotal);
    const share = Math.min(slack, headroom[i], i === phases.length - 1 ? slack : proportional);
    allocated[i] += share;
    slack -= share;
  }

  return allocated;
}

/**
 * Picks the module for a phase.
 *
 * Rule 8: the choice comes from this person's own outcomes, not from a larger
 * prompt. A module they have rated well wins; an unrated one sits at neutral;
 * a module with too few ratings to mean anything is treated as unrated rather
 * than trusted. Ties break toward the longer module, because it uses more of
 * the allocation, and then by key so the result is deterministic.
 */
export function pick(
  candidates: readonly PlanModule[],
  allocatedSeconds: number,
  scores: ReadonlyMap<string, number>
): PlanModule | null {
  const fits = candidates.filter((m) => m.durationSeconds <= allocatedSeconds);
  if (fits.length === 0) return null;

  return fits.reduce((best, candidate) => {
    const bestScore = scores.get(best.id) ?? NEUTRAL_SCORE;
    const candidateScore = scores.get(candidate.id) ?? NEUTRAL_SCORE;

    if (candidateScore !== bestScore) return candidateScore > bestScore ? candidate : best;
    if (candidate.durationSeconds !== best.durationSeconds) {
      return candidate.durationSeconds > best.durationSeconds ? candidate : best;
    }
    return candidate.moduleKey < best.moduleKey ? candidate : best;
  });
}

/**
 * Turns effectiveness tallies into scores.
 *
 * A tally below `MIN_SAMPLE` is dropped rather than scored, so one good
 * session cannot decide a module's fate for ever.
 */
export function scoresFrom(
  rows: readonly { moduleId: string; positive: number; total: number }[]
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const row of rows) {
    if (row.total >= MIN_SAMPLE) scores.set(row.moduleId, row.positive / row.total);
  }
  return scores;
}

/**
 * Fills a phase with as many approved modules as its allocation holds.
 *
 * WHY CHAINING EXISTS. One module per phase meant the leftover became silence,
 * and at twenty minutes the leftovers are enormous: `stabilise_attention` is
 * allocated 402s, `build_readiness` 400s. With modules around 180s that made a
 * long session roughly a third silence, and around 120s roughly half. The way
 * out was either to commission 400-second recordings — expensive, and a
 * 400-second module is far less reusable than four 100-second ones — or to let
 * a phase play several. Chaining keeps modules small, reusable and cheap,
 * which is the whole economic thesis.
 *
 * NO MODULE REPEATS WITHIN A PHASE. Hearing the same technique twice in a row
 * is a content judgement, not an engineering one, so the conservative choice is
 * taken: when the eligible modules are exhausted the rest of the phase is
 * silence. If repetition turns out to be acceptable, that is a product decision
 * and this is the one place it would change.
 *
 * NOT OPTIMAL PACKING, DELIBERATELY. Modules are taken best-rated first, then
 * longest, which can leave more silence than a perfect fit would: given a 400s
 * slot and modules of 250s, 200s and 180s, this takes the 250 and stops, where
 * 200 + 180 would have packed tighter. Rule 8 says the person hears what works
 * for them; squeezing out the last seconds of silence is worth less than that,
 * and a packing algorithm nobody can predict is worth less still.
 */
export function fillPhase(
  candidates: readonly PlanModule[],
  allocatedSeconds: number,
  scores: ReadonlyMap<string, number>
): PlanModule[] {
  const chosen: PlanModule[] = [];
  const used = new Set<string>();
  let remaining = allocatedSeconds;

  // Bounded by the candidate list: every iteration either takes a module out
  // of contention or stops.
  while (remaining > 0) {
    const next = pick(
      candidates.filter((m) => !used.has(m.id)),
      remaining,
      scores
    );
    if (!next) break;

    chosen.push(next);
    used.add(next.id);
    remaining -= next.durationSeconds;
  }

  return chosen;
}

/**
 * The whole phase plan: allocation, selection, and the silence that fills what
 * the chosen modules do not use.
 *
 * Returns positions relative to the start of the phase sequence. The caller
 * adds any speech around it and offsets accordingly, because speech is the one
 * part the two environments handle differently.
 */
export function planPhases(
  phases: readonly PlanPhase[],
  candidatesByPhase: (phase: string) => readonly PlanModule[],
  scores: ReadonlyMap<string, number>,
  availableSeconds: number,
  startOffset = 0
): Plan {
  const allocation = allocate(phases, availableSeconds);
  if (allocation === null) return { ok: false, failure: 'duration_unreachable' };

  const segments: PlanSegment[] = [];
  let offset = startOffset;

  for (let i = 0; i < phases.length; i += 1) {
    const phase = phases[i];
    const seconds = allocation[i];
    const chosen = fillPhase(candidatesByPhase(phase.phase), seconds, scores);

    // A phase nothing fits cannot be filled at all. Better no session than one
    // with an unapproved or empty phase in the middle of it.
    if (chosen.length === 0) return { ok: false, failure: 'phase_unfilled' };

    let spent = 0;
    for (const module of chosen) {
      segments.push({
        kind: 'module',
        phase: phase.phase,
        offsetSeconds: offset,
        durationSeconds: module.durationSeconds,
        module,
      });
      offset += module.durationSeconds;
      spent += module.durationSeconds;
    }

    // Whatever the phase was allocated but its modules did not use becomes
    // composed silence attributed to that phase (S15) — never a mystery gap,
    // and never baked into an audio file.
    const remainder = seconds - spent;
    if (remainder > 0) {
      segments.push({
        kind: 'silence',
        phase: phase.phase,
        offsetSeconds: offset,
        durationSeconds: remainder,
      });
      offset += remainder;
    }
  }

  return { ok: true, segments, totalSeconds: offset };
}
