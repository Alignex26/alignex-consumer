import { checkBudget } from '@/lib/voice/budget';
import type {
  CompositionFailure,
  CompositionResult,
  InterventionModule,
  ManifestSegment,
  ModuleEffectiveness,
  RecipePhase,
  SpeechRequest,
} from '@/types/session-engine';
import type { TransitionKey } from '@/types/elsea';

/**
 * The composition engine.
 *
 * Turns a decision — this transition, this long, for this person — into a
 * manifest of references. It never renders audio, never calls a provider, and
 * never produces a whole session file. Duration is an input here rather than
 * part of an intervention's identity, which is P4 expressed structurally.
 *
 * Deliberately pure. Everything it needs is passed in, so the allocation and
 * selection rules are testable without a database, a network or a clock, and
 * the same inputs always give the same manifest.
 */

/** Below this many rated runs a single opinion would decide a module's fate. */
const MIN_SAMPLE = 3;

/** An unrated module is neither preferred nor penalised. */
const NEUTRAL_SCORE = 0.5;

export type CompositionInput = {
  transitionKey: TransitionKey;
  /** What the person said they had. */
  durationSeconds: number;
  recipeVersion?: number;
  phases: readonly RecipePhase[];
  /** Approved, active, affinity-filtered candidates, grouped by phase. */
  modulesByPhase: Readonly<Record<string, readonly InterventionModule[]>>;
  /** Optional background layer. */
  bed?: InterventionModule | null;
  /** This person's history. Absent for anyone signed out — and that is fine. */
  effectiveness?: readonly ModuleEffectiveness[];
  /** Dynamic speech, already built from structured state. */
  speech?: readonly SpeechRequest[];
};

function fail(failure: CompositionFailure): CompositionResult {
  return { ok: false, failure };
}

/**
 * Allocates the available seconds across phases.
 *
 * Every phase starts at its floor, and whatever is left is dealt out in
 * proportion to how much headroom each phase has. A phase with a wide
 * min-to-max range absorbs more of the extra time than a tightly specified
 * one, which is what lets the same recipe serve five minutes and twenty
 * without changing its shape.
 */
function allocate(
  phases: readonly RecipePhase[],
  available: number
): number[] | null {
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
    // Every share is clamped to the phase's own headroom. Without that clamp a
    // long session pushes its whole surplus into the first phase and runs it
    // past `maxSeconds` — a regulation phase approved for at most three
    // minutes silently running five. The last phase mops up the rounding, but
    // it is clamped too.
    const proportional = Math.round((headroom[i] / totalHeadroom) * slackTotal);
    const share = Math.min(slack, headroom[i], i === phases.length - 1 ? slack : proportional);

    allocated[i] += share;
    slack -= share;
  }

  // Any surplus left once every phase is at its ceiling is simply not
  // allocated: the session comes out shorter than asked for, and
  // `durationSeconds` on the manifest reports what was actually composed.
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
function pick(
  candidates: readonly InterventionModule[],
  allocatedSeconds: number,
  scores: Map<string, number>
): InterventionModule | null {
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

function scoreMap(effectiveness: readonly ModuleEffectiveness[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const e of effectiveness) {
    if (e.total >= MIN_SAMPLE) scores.set(e.moduleId, e.positive / e.total);
  }
  return scores;
}

/**
 * Composes a session.
 *
 * Order of checks is deliberate: the speech budget is verified BEFORE anything
 * else, so a session that would overspend is rejected without a provider ever
 * being asked to make audio. Rejected, not trimmed — a silent trim would hide
 * exactly the drift the ceiling exists to catch.
 */
export function compose(input: CompositionInput): CompositionResult {
  const phases = [...input.phases]
    .filter((p) => p.transitionKey === input.transitionKey)
    .sort((a, b) => a.ordinal - b.ordinal);

  if (phases.length === 0) return fail('no_recipe');

  const speech = input.speech ?? [];
  const verdict = checkBudget(speech);
  if (!verdict.ok) return fail('budget_exceeded');

  const spokenSeconds = Math.round(verdict.totalSeconds);
  const available = input.durationSeconds - spokenSeconds;

  const hasAnyModule = phases.some((p) => (input.modulesByPhase[p.phase] ?? []).length > 0);
  if (!hasAnyModule) return fail('library_empty');

  const allocation = allocate(phases, available);
  if (allocation === null) return fail('duration_unreachable');

  const scores = scoreMap(input.effectiveness ?? []);
  const segments: ManifestSegment[] = [];
  let ordinal = 0;
  let offset = 0;

  const opening = speech.find((s) => s.slot === 'opening');
  if (opening) {
    const seconds = Math.round(opening.estimatedSeconds);
    segments.push({
      kind: 'generated',
      ordinal: ordinal++,
      layer: 'foreground',
      offsetSeconds: offset,
      durationSeconds: seconds,
      speech: opening,
    });
    offset += seconds;
  }

  for (let i = 0; i < phases.length; i += 1) {
    const phase = phases[i];
    const seconds = allocation[i];
    const candidates = input.modulesByPhase[phase.phase] ?? [];
    const chosen = pick(candidates, seconds, scores);

    if (!chosen) return fail('phase_unfilled');

    segments.push({
      kind: 'module',
      ordinal: ordinal++,
      layer: 'foreground',
      offsetSeconds: offset,
      durationSeconds: chosen.durationSeconds,
      moduleId: chosen.id,
      moduleKey: chosen.moduleKey,
      phase: phase.phase,
    });
    offset += chosen.durationSeconds;

    // Whatever the phase was allocated but the module did not use becomes
    // composed silence attributed to that phase — never a mystery gap, and
    // never baked into an audio file (S15).
    const remainder = seconds - chosen.durationSeconds;
    if (remainder > 0) {
      segments.push({
        kind: 'silence',
        ordinal: ordinal++,
        layer: 'foreground',
        offsetSeconds: offset,
        durationSeconds: remainder,
        phase: phase.phase,
      });
      offset += remainder;
    }
  }

  const closing = speech.find((s) => s.slot === 'closing');
  if (closing) {
    const seconds = Math.round(closing.estimatedSeconds);
    segments.push({
      kind: 'generated',
      ordinal: ordinal++,
      layer: 'foreground',
      offsetSeconds: offset,
      durationSeconds: seconds,
      speech: closing,
    });
    offset += seconds;
  }

  // The bed runs underneath the whole composition as a concurrent layer, which
  // is why it carries its own ordinal sequence rather than joining the
  // foreground one.
  if (input.bed) {
    segments.push({
      kind: 'module',
      ordinal: 0,
      layer: 'bed',
      offsetSeconds: 0,
      durationSeconds: offset,
      moduleId: input.bed.id,
      moduleKey: input.bed.moduleKey,
      phase: 'bed',
    });
  }

  return {
    ok: true,
    manifest: {
      transitionKey: input.transitionKey,
      // What was actually composed, which can be under the request when every
      // phase is already at its ceiling. Reporting the request would be a lie.
      durationSeconds: offset,
      recipeVersion: input.recipeVersion ?? 1,
      dynamicSeconds: spokenSeconds,
      segments,
    },
  };
}
