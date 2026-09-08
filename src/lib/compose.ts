import { checkBudget } from '@/lib/voice/budget';
import type { TransitionKey } from '@/types/elsea';
import type {
  CompositionFailure,
  CompositionResult,
  InterventionModule,
  ManifestSegment,
  ModuleEffectiveness,
  RecipePhase,
  SpeechRequest,
} from '@/types/session-engine';

// The ONE implementation of the allocation and selection algorithm, shared
// with the Deno Edge Function that composes server-side. There is no second
// copy. See that file's header: it must stay dependency-free, or the sharing
// breaks and the duplication comes back.
import { planPhases, scoresFrom } from '../../supabase/functions/_shared/allocate';

/**
 * The composition engine.
 *
 * Turns a decision — this transition, this long, for this person — into a
 * manifest of references. It never renders audio, never calls a provider, and
 * never produces a whole session file. Duration is an input here rather than
 * part of an intervention's identity, which is P4 expressed structurally.
 *
 * Deliberately pure. Everything it needs is passed in, so the rules are
 * testable without a database, a network or a clock, and the same inputs
 * always give the same manifest.
 *
 * NOTE ON WHERE THIS RUNS. In production the decision is made server-side, in
 * `supabase/functions/compose`, because the recipes are proprietary and the
 * budget must be enforced where the paid provider can actually be called. This
 * module is the same algorithm, kept importable and directly testable.
 */

export type CompositionInput = {
  transitionKey: TransitionKey;
  /** What the person said they had. */
  durationSeconds: number;
  recipeVersion?: number;
  phases: readonly RecipePhase[];
  /** Approved, active, family-eligible candidates, grouped by phase. */
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

  const plan = planPhases(
    phases,
    (phase) => input.modulesByPhase[phase] ?? [],
    scoresFrom(input.effectiveness ?? []),
    available,
    offset
  );

  if (!plan.ok) return fail(plan.failure);

  for (const segment of plan.segments) {
    if (segment.kind === 'module' && segment.module) {
      segments.push({
        kind: 'module',
        ordinal: ordinal++,
        layer: 'foreground',
        offsetSeconds: segment.offsetSeconds,
        durationSeconds: segment.durationSeconds,
        moduleId: segment.module.id,
        moduleKey: segment.module.moduleKey,
        storagePath: segment.module.storagePath,
        phase: segment.phase,
      });
    } else {
      segments.push({
        kind: 'silence',
        ordinal: ordinal++,
        layer: 'foreground',
        offsetSeconds: segment.offsetSeconds,
        durationSeconds: segment.durationSeconds,
        phase: segment.phase,
      });
    }
  }
  offset = plan.totalSeconds;

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
      storagePath: input.bed.storagePath,
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
