import { compose } from '@/lib/compose';
import { getSupabase } from '@/lib/supabase';
import type { TransitionKey } from '@/types/elsea';
import type {
  CompositionResult,
  InterventionModule,
  ModuleEffectiveness,
  RecipePhase,
  SpeechRequest,
} from '@/types/session-engine';

/**
 * Loading what `compose` needs, and composing.
 *
 * The seam between the database and the pure engine. Everything here is
 * fetching and shape-mapping; every decision about what a session contains
 * happens in `compose`, which is why that stays testable without any of this.
 *
 * TODAY THIS ALWAYS FAILS, and that is correct. `recipe_phases` and
 * `intervention_modules` are live and empty, so the result is `no_recipe` or
 * `library_empty` and the caller falls back to the catalogue path. It starts
 * succeeding the moment the five recipes and their modules land, with no code
 * change — which is the point of wiring it now rather than later.
 */

type ModuleRow = {
  id: string;
  module_key: string;
  family: string;
  technique_key: string;
  storage_path: string;
  duration_seconds: number;
  intensity: number;
  requires_headphones: boolean;
  is_bed: boolean;
};

function toModule(row: ModuleRow): InterventionModule {
  return {
    id: row.id,
    moduleKey: row.module_key,
    family: row.family as InterventionModule['family'],
    techniqueKey: row.technique_key,
    storagePath: row.storage_path,
    durationSeconds: row.duration_seconds,
    intensity: row.intensity,
    requiresHeadphones: row.requires_headphones,
    isBed: row.is_bed,
  };
}

/**
 * Composes a session for this person.
 *
 * `speech` is empty by default and nothing here fills it. Dynamic narration
 * needs a provider, which is a decision that has not been made, and it must be
 * generated server-side where the key lives. An empty list composes a session
 * entirely from reusable content that bills nothing — the correct default, and
 * the one the guardrails already enforce.
 */
export async function loadComposition(
  transitionKey: TransitionKey,
  durationSeconds: number,
  userId: string | null,
  speech: readonly SpeechRequest[] = []
): Promise<CompositionResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, failure: 'library_empty' };

  try {
    // Modules reach this screen only through an affinity row, so a module can
    // never drift into a recipe it was not approved for. RLS already limits
    // the join to approved, active modules.
    const [phasesResult, affinityResult] = await Promise.all([
      supabase
        .from('recipe_phases')
        .select('transition_key, ordinal, phase, min_seconds, max_seconds, is_provisional')
        .eq('transition_key', transitionKey)
        .order('ordinal', { ascending: true }),
      supabase
        .from('module_affinities')
        .select('phase, intervention_modules(*)')
        .eq('transition_key', transitionKey),
    ]);

    const phases: RecipePhase[] = (phasesResult.data ?? []).map((row) => ({
      transitionKey: row.transition_key as TransitionKey,
      ordinal: row.ordinal,
      phase: row.phase,
      minSeconds: row.min_seconds,
      maxSeconds: row.max_seconds,
      isProvisional: row.is_provisional,
    }));

    if (phases.length === 0) return { ok: false, failure: 'no_recipe' };

    const modulesByPhase: Record<string, InterventionModule[]> = {};
    let bed: InterventionModule | null = null;

    for (const row of affinityResult.data ?? []) {
      // PostgREST returns the embedded row as an object or a single-element
      // array depending on how it infers the relationship; both are handled
      // rather than assumed.
      const embedded = row.intervention_modules;
      const moduleRow = (Array.isArray(embedded) ? embedded[0] : embedded) as ModuleRow | null;
      if (!moduleRow) continue;

      const module_ = toModule(moduleRow);

      // A bed is a layer, not a step in the sequence, so it never joins the
      // phase candidates it would otherwise compete in.
      if (module_.isBed) {
        bed = bed ?? module_;
        continue;
      }

      (modulesByPhase[row.phase] ??= []).push(module_);
    }

    // Personalisation is a tally, not a model, and it is optional: someone
    // signed out simply composes without it.
    let effectiveness: ModuleEffectiveness[] = [];
    if (userId) {
      const { data } = await supabase
        .from('module_effectiveness')
        .select('module_id, positive, total')
        .eq('user_id', userId);

      effectiveness = (data ?? []).map((row) => ({
        moduleId: row.module_id,
        positive: row.positive,
        total: row.total,
      }));
    }

    return compose({
      transitionKey,
      durationSeconds,
      phases,
      modulesByPhase,
      bed,
      effectiveness,
      speech,
    });
  } catch {
    // A failure to load is not a failure to compose, but the caller only needs
    // to know it cannot use the engine path.
    return { ok: false, failure: 'library_empty' };
  }
}
