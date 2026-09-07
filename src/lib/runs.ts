import { getSupabase } from '@/lib/supabase';
import type {
  CatalogueSession,
  Interpretation,
  Outcome,
  RunStatus,
  SessionRun,
  TransitionKey,
} from '@/types/elsea';

/**
 * Session runs and outcomes.
 *
 * Runs live in `user_sessions`, which already existed in the database. It is
 * reused rather than shadowed by a second table meaning the same thing.
 *
 * That table predates the product's current needs and carries a `completed`
 * boolean alongside the newer `status`. Both are written here and kept in
 * step, so anything already reading `completed` / `completed_at` keeps working
 * while `status` carries the distinction `completed` cannot express — that an
 * early exit is a measurement rather than a failure.
 *
 * Nothing in here writes free text. A run records which approved session was
 * played, which transition it served, how far the person got and how it ended;
 * an outcome records one of three controlled values. That is the whole record.
 *
 * Every function tolerates being offline or signed out. Persistence failing
 * must never stop someone having their session — so these return null and the
 * flow carries on with an in-memory run.
 */

type RunRow = {
  id: string;
  session_id: string;
  transition_key: string;
  duration_seconds: number;
  status: RunStatus;
  elapsed_seconds: number;
  started_at: string;
  ended_at: string | null;
};

function toRun(row: RunRow): SessionRun {
  return {
    id: row.id,
    sessionId: row.session_id,
    transitionKey: row.transition_key,
    durationSeconds: row.duration_seconds,
    status: row.status,
    elapsedSeconds: row.elapsed_seconds,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

/**
 * A run that exists only on the device.
 *
 * Used for anonymous people and whenever the write fails. The id is prefixed
 * so it is obvious at a glance that it was never persisted, and so it can
 * never be mistaken for a database id by the outcome write.
 */
function localRun(session: CatalogueSession, transitionKey: string): SessionRun {
  return {
    id: `local:${Date.now()}`,
    sessionId: session.id,
    transitionKey,
    durationSeconds: session.durationSeconds,
    status: 'started',
    elapsedSeconds: 0,
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
}

export function isPersisted(run: SessionRun): boolean {
  return !run.id.startsWith('local:');
}

export async function startRun(
  session: CatalogueSession,
  interpretation: Interpretation,
  userId: string | null
): Promise<SessionRun> {
  const supabase = getSupabase();
  if (!supabase || !userId) return localRun(session, interpretation.transitionKey);

  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_id: session.id,
        transition_key: interpretation.transitionKey,
        duration_seconds: session.durationSeconds,
        state_current: interpretation.stateCurrent,
        state_target: interpretation.stateTarget,
        context_tag: interpretation.contextTag,
        origin: interpretation.origin,
        status: 'started',
        completed: false,
      })
      .select('id, session_id, transition_key, duration_seconds, status, elapsed_seconds, started_at, ended_at')
      .single();

    if (error || !data) return localRun(session, interpretation.transitionKey);
    return toRun(data as RunRow);
  } catch {
    return localRun(session, interpretation.transitionKey);
  }
}

/**
 * Closes a run.
 *
 * Idempotent by intent: it only ever moves a run from `started` to a terminal
 * status, so a completion arriving twice cannot produce two endings.
 */
export async function finishRun(
  run: SessionRun,
  status: Exclude<RunStatus, 'started'>,
  elapsedSeconds: number
): Promise<SessionRun> {
  const closed: SessionRun = {
    ...run,
    status,
    elapsedSeconds,
    endedAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (!supabase || !isPersisted(run)) return closed;

  try {
    await supabase
      .from('user_sessions')
      .update({
        status,
        elapsed_seconds: Math.max(0, Math.round(elapsedSeconds)),
        ended_at: closed.endedAt,
        // Kept in step with `status` for anything still reading the older
        // boolean. Only a full completion sets it.
        completed: status === 'completed',
        completed_at: status === 'completed' ? closed.endedAt : null,
      })
      .eq('id', run.id)
      .eq('status', 'started');
  } catch {
    // The person's session still happened. Losing the write is not their
    // problem to see.
  }

  return closed;
}

/**
 * Records the outcome.
 *
 * One row per run — a second call for the same run updates rather than
 * duplicates, which is what the unique constraint on `run_id` enforces.
 */
export async function recordOutcome(
  run: SessionRun,
  outcome: Outcome,
  userId: string | null,
  detailCode: string | null = null
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !userId || !isPersisted(run)) return false;

  try {
    const { error } = await supabase
      .from('session_outcomes')
      .upsert(
        { run_id: run.id, user_id: userId, outcome, detail_code: detailCode },
        { onConflict: 'run_id' }
      );
    return !error;
  } catch {
    return false;
  }
}

export type RunHistoryEntry = {
  runId: string;
  transitionKey: TransitionKey;
  sessionId: string;
  durationSeconds: number;
  status: RunStatus;
  outcome: Outcome | null;
  startedAt: string;
};

/**
 * The person's own recent sessions, newest first. Empty when signed out —
 * never fabricated.
 */
export async function recentRuns(userId: string | null, limit = 20): Promise<RunHistoryEntry[]> {
  const supabase = getSupabase();
  if (!supabase || !userId) return [];

  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select(
        'id, session_id, transition_key, duration_seconds, status, started_at, session_outcomes(outcome)'
      )
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return (data as unknown as Record<string, unknown>[]).map((row) => {
      const outcomes = row.session_outcomes as { outcome: Outcome }[] | null;
      return {
        runId: row.id as string,
        transitionKey: row.transition_key as TransitionKey,
        sessionId: row.session_id as string,
        durationSeconds: row.duration_seconds as number,
        status: row.status as RunStatus,
        outcome: outcomes?.[0]?.outcome ?? null,
        startedAt: row.started_at as string,
      };
    });
  } catch {
    return [];
  }
}
