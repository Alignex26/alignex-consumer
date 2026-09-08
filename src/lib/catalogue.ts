import { getSupabase } from '@/lib/supabase';
import {
  DURATION_RANGE,
  type CatalogueSession,
  type DurationChoice,
  type SessionSegment,
  type TransitionKey,
} from '@/types/elsea';

/**
 * Session selection.
 *
 * Selection is deterministic and reads from the approved catalogue only. The
 * model never chooses a session and never generates one: it produces a
 * transition, and this decides which approved session serves it.
 *
 * The rule, in order:
 *   1. only active sessions for the interpreted transition;
 *   2. only those matching the chosen duration exactly;
 *   3. where nothing matches exactly, take the nearest available duration,
 *      preferring the shorter of two equally near options — a session that
 *      runs longer than the time someone said they had is the worse miss.
 *
 * Deliberately no personalisation here. It used to prefer a row the person had
 * rated well, but `sessions_catalogue` is unique on
 * (transition_key, duration_seconds), so an exact duration identifies exactly
 * one row: there is nothing to choose between, and the outcome query it ran on
 * every selection could never change the result. Personalisation moved up a
 * level, to which duration is suggested — see `@/lib/personalisation`.
 *
 * Every input is a controlled value, so the reasoning is explainable. There is
 * no score, no weighting matrix and no opaque ranking.
 */

type Row = {
  id: string;
  transition_key: string;
  duration_seconds: number;
  intensity: number;
  requires_headphones: boolean;
};

function toSession(row: Row): CatalogueSession {
  return {
    id: row.id,
    transitionKey: row.transition_key,
    durationSeconds: row.duration_seconds,
    intensity: row.intensity,
    requiresHeadphones: row.requires_headphones,
  };
}

export type SelectionFailure = 'unconfigured' | 'network' | 'none_eligible';

export type SelectionResult =
  | { ok: true; session: CatalogueSession }
  | { ok: false; failure: SelectionFailure };

export async function selectSession(
  transitionKey: TransitionKey,
  choice: DurationChoice
): Promise<SelectionResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, failure: 'unconfigured' };

  const { data, error } = await supabase
    .from('sessions_catalogue')
    .select('id, transition_key, duration_seconds, intensity, requires_headphones')
    .eq('transition_key', transitionKey)
    .eq('is_active', true)
    .order('duration_seconds', { ascending: true });

  if (error) return { ok: false, failure: 'network' };

  const all = ((data ?? []) as Row[]).map(toSession);
  if (all.length === 0) return { ok: false, failure: 'none_eligible' };

  const range = DURATION_RANGE[choice];

  // Sessions that fit the stated time. `unsure` states no time, so nothing is
  // filtered and nothing "fits" in the sense that matters below.
  const fits = range
    ? all.filter((s) => s.durationSeconds >= range.min && s.durationSeconds <= range.max)
    : [];

  const shortest = (a: CatalogueSession, b: CatalogueSession) =>
    b.durationSeconds < a.durationSeconds ? b : a;

  // An exact match: any of them will do, they are the same length.
  if (fits.length > 0) {
    return { ok: true, session: fits.reduce(shortest) };
  }

  // "Not sure" states no time, so it resolves to the shortest approved session
  // — a first experience should never run longer than someone expected. This
  // is the rule the interpret Edge Function already applies when the person's
  // text mentions no duration.
  if (!range) {
    return { ok: true, session: all.reduce(shortest) };
  }

  // A time was asked for and this family has no session of that length. Take
  // the nearest one rather than the shortest: falling back to the shortest
  // would answer a request for twenty minutes with a three-minute session.
  // Ties go to the shorter, so the miss is never an overrun.
  const target = range.min;
  const nearest = all.reduce((best, candidate) => {
    const dBest = Math.abs(best.durationSeconds - target);
    const dCandidate = Math.abs(candidate.durationSeconds - target);
    if (dCandidate < dBest) return candidate;
    if (dCandidate > dBest) return best;
    return candidate.durationSeconds < best.durationSeconds ? candidate : best;
  });

  return { ok: true, session: nearest };
}

/** The audio segments for a session, in order. */
export async function loadSegments(sessionId: string): Promise<SessionSegment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('session_segments')
    .select('id, ordinal, storage_path, duration_seconds')
    .eq('session_id', sessionId)
    .order('ordinal', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    ordinal: row.ordinal as number,
    storagePath: row.storage_path as string,
    durationSeconds: row.duration_seconds as number,
  }));
}
