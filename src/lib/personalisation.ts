import { recentRuns } from '@/lib/runs';
import {
  DURATION_RANGE,
  type DurationChoice,
  type Outcome,
} from '@/types/elsea';

/**
 * The personalisation boundary.
 *
 * WHY THIS EXISTS SEPARATELY. Personalisation used to live inside
 * `selectSession`, preferring a catalogue row the person had rated well. Once
 * durations became exact that stopped being possible: `sessions_catalogue`
 * carries a unique constraint on (transition_key, duration_seconds), so a
 * transition and a duration together identify exactly one row. There is
 * nothing to choose between, and the query it ran on every selection could
 * never change the outcome.
 *
 * Recipe choice is equally determined today — one recipe per family — so the
 * level personalisation can actually act at is the one thing neither the
 * person nor the taxonomy fixes: which duration to SUGGEST before they choose.
 * That is what this derives.
 *
 * It suggests and never imposes: the chosen duration remains whatever the
 * person taps. Under the composition architecture the planner will consume
 * richer parameters from here, which is why this is a named boundary rather
 * than a helper inside a screen.
 */

/** Below this many rated runs, one good session would decide everything. */
const MIN_RATED_RUNS = 4;
/** And below this per duration, a single rating would carry a whole band. */
const MIN_PER_DURATION = 2;

const POSITIVE: Outcome[] = ['yes', 'partly'];

export type RecipePreferences = {
  /**
   * The duration this person has rated best, or null when there is not enough
   * evidence. Null is the common and correct answer early on.
   */
  suggestedDuration: DurationChoice | null;
  /** How many rated runs the suggestion rests on. Shown nowhere; kept honest. */
  ratedRuns: number;
};

export const NO_PREFERENCES: RecipePreferences = {
  suggestedDuration: null,
  ratedRuns: 0,
};

/** The choice whose exact duration matches these seconds, if any. */
function choiceForSeconds(seconds: number): DurationChoice | null {
  for (const [choice, range] of Object.entries(DURATION_RANGE)) {
    if (range && range.min === seconds) return choice as DurationChoice;
  }
  return null;
}

/**
 * Derives what to suggest from this person's own recorded outcomes.
 *
 * Deliberately arithmetic and explainable in a sentence: the duration they
 * rated positively most often, given enough ratings to mean anything. No
 * score, no weighting, no model. Returns nothing for anyone signed out or
 * early on, and the screen simply pre-selects nothing.
 */
export async function loadRecipePreferences(
  userId: string | null
): Promise<RecipePreferences> {
  if (!userId) return NO_PREFERENCES;

  const runs = await recentRuns(userId, 100);
  const rated = runs.filter((run) => run.outcome !== null);
  if (rated.length < MIN_RATED_RUNS) return { suggestedDuration: null, ratedRuns: rated.length };

  const tally = new Map<DurationChoice, { positive: number; total: number }>();
  for (const run of rated) {
    const choice = choiceForSeconds(run.durationSeconds);
    if (!choice) continue;
    const current = tally.get(choice) ?? { positive: 0, total: 0 };
    tally.set(choice, {
      positive: current.positive + (POSITIVE.includes(run.outcome as Outcome) ? 1 : 0),
      total: current.total + 1,
    });
  }

  let best: { choice: DurationChoice; rate: number; total: number } | null = null;
  for (const [choice, { positive, total }] of tally) {
    if (total < MIN_PER_DURATION) continue;
    const rate = positive / total;
    // Ties go to the better-evidenced duration rather than to map order.
    if (!best || rate > best.rate || (rate === best.rate && total > best.total)) {
      best = { choice, rate, total };
    }
  }

  // A duration nobody rates positively is not a suggestion worth making.
  if (!best || best.rate <= 0.5) {
    return { suggestedDuration: null, ratedRuns: rated.length };
  }

  return { suggestedDuration: best.choice, ratedRuns: rated.length };
}
