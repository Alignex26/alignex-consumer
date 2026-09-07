import { recentRuns, type RunHistoryEntry } from '@/lib/runs';
import type { Outcome, TransitionKey } from '@/types/elsea';

/**
 * What ELSEA has actually learned about someone.
 *
 * Deliberately arithmetic, not machine learning. Every number here is a count
 * of things that genuinely happened, and every claim the UI makes from it is
 * traceable to rows in `user_sessions` and `session_outcomes`. There is no
 * score, no weighting and no model.
 *
 * `hasEnoughData` exists so the screen can say "not yet" honestly rather than
 * dressing up two sessions as a pattern.
 */

/** Below this, one good or bad session dominates and nothing is meaningful. */
const MINIMUM_RUNS_FOR_PATTERNS = 4;

export type DurationBand = 'under_5' | 'five_to_ten' | 'over_ten';

export function bandFor(seconds: number): DurationBand {
  if (seconds < 300) return 'under_5';
  if (seconds <= 600) return 'five_to_ten';
  return 'over_ten';
}

export type Patterns = {
  totalRuns: number;
  completedRuns: number;
  hasEnoughData: boolean;
  /** Times each transition has been used, most used first. */
  transitionCounts: { transition: TransitionKey; count: number }[];
  /**
   * Reported outcomes per duration band. Only bands with at least two
   * sessions appear — one data point is not a finding.
   */
  durationOutcomes: { band: DurationBand; positive: number; total: number }[];
  /** The most recent run, for Today and Quick Return. */
  mostRecent: RunHistoryEntry | null;
  /** The most recent run the person said worked. Drives Quick Return. */
  mostRecentPositive: RunHistoryEntry | null;
};

const POSITIVE: Outcome[] = ['yes', 'partly'];

export async function loadPatterns(userId: string | null): Promise<Patterns> {
  const runs = await recentRuns(userId, 100);

  const transitionMap = new Map<TransitionKey, number>();
  const bandMap = new Map<DurationBand, { positive: number; total: number }>();

  for (const run of runs) {
    transitionMap.set(run.transitionKey, (transitionMap.get(run.transitionKey) ?? 0) + 1);

    if (run.outcome) {
      const band = bandFor(run.durationSeconds);
      const current = bandMap.get(band) ?? { positive: 0, total: 0 };
      bandMap.set(band, {
        positive: current.positive + (POSITIVE.includes(run.outcome) ? 1 : 0),
        total: current.total + 1,
      });
    }
  }

  return {
    totalRuns: runs.length,
    completedRuns: runs.filter((r) => r.status === 'completed').length,
    hasEnoughData: runs.length >= MINIMUM_RUNS_FOR_PATTERNS,
    transitionCounts: Array.from(transitionMap.entries())
      .map(([transition, count]) => ({ transition, count }))
      .sort((a, b) => b.count - a.count),
    durationOutcomes: Array.from(bandMap.entries())
      .filter(([, value]) => value.total >= 2)
      .map(([band, value]) => ({ band, ...value })),
    mostRecent: runs[0] ?? null,
    mostRecentPositive: runs.find((r) => r.outcome === 'yes') ?? null,
  };
}
