import { getSupabase } from '@/lib/supabase';
import {
  DURATION_RANGE,
  type CatalogueSession,
  type DurationChoice,
  type Outcome,
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
 *   2. only those inside the chosen time range;
 *   3. of those, prefer whatever this person has actually reported working;
 *   4. break ties on the longest that fits, because a session cut short by
 *      the clock is worse than one that ends early.
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
  | { ok: true; session: CatalogueSession; personalised: boolean }
  | { ok: false; failure: SelectionFailure };

/**
 * Sessions this person has reported a good outcome from, most recent first.
 *
 * Returns an empty list for anonymous users and whenever history cannot be
 * read — personalisation is an improvement on the default, never a
 * precondition for it.
 */
async function sessionsThatWorked(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();

  const supabase = getSupabase();
  if (!supabase) return new Set();

  const { data, error } = await supabase
    .from('session_outcomes')
    .select('outcome, user_sessions!inner(session_id)')
    .eq('user_id', userId)
    .eq('outcome', 'yes' satisfies Outcome)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return new Set();

  const ids = new Set<string>();
  for (const row of data as unknown as { user_sessions?: { session_id?: string } }[]) {
    const id = row.user_sessions?.session_id;
    if (id) ids.add(id);
  }
  return ids;
}

export async function selectSession(
  transitionKey: TransitionKey,
  choice: DurationChoice,
  userId: string | null
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

  const pool = fits.length > 0 ? fits : all;

  const worked = await sessionsThatWorked(userId);
  const previouslyWorked = pool.filter((s) => worked.has(s.id));
  if (previouslyWorked.length > 0) {
    return {
      ok: true,
      session: previouslyWorked.reduce((a, b) =>
        b.durationSeconds > a.durationSeconds ? b : a
      ),
      personalised: true,
    };
  }

  // Where a time was given, take the longest that fits: a session cut short by
  // the clock is worse than one that ends with time to spare.
  //
  // Where none was — "Not sure", or a range nothing falls into — take the
  // shortest, so a session never runs longer than someone was expecting. This
  // matches the rule the interpret Edge Function already applies when the
  // person's text mentions no duration.
  const longest = (a: CatalogueSession, b: CatalogueSession) =>
    b.durationSeconds > a.durationSeconds ? b : a;
  const shortest = (a: CatalogueSession, b: CatalogueSession) =>
    b.durationSeconds < a.durationSeconds ? b : a;

  return {
    ok: true,
    session: pool.reduce(fits.length > 0 ? longest : shortest),
    personalised: false,
  };
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
