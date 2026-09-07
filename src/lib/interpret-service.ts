import { callInterpret, isSupabaseConfigured } from '@/lib/supabase';
import {
  isTransitionKey,
  STATES_CURRENT,
  STATES_TARGET,
  type InterpretResult,
  type Interpretation,
  type StateCurrent,
  type StateTarget,
} from '@/types/elsea';

/**
 * The safety pipeline, from the client's side.
 *
 * There is exactly one function here and it always returns one of three
 * outcomes. There is no path through this file that produces an interpretation
 * without the server having said `route: 'session'`, and no path that turns an
 * error into anything other than `diverted`.
 *
 * FAIL CLOSED: every failure — no network, Supabase unconfigured, a malformed
 * response, an unrecognised state, a bad transition key — resolves to
 * `diverted`. Not to an interpretation, not to a retry that guesses, not to a
 * "probably fine". If we cannot prove the input was checked, we behave as
 * though it was flagged.
 */

export type SafetyOutcome =
  /** Safe, and understood. The only outcome that carries an interpretation. */
  | { kind: 'interpreted'; interpretation: Interpretation }
  /**
   * Safe, but not understood well enough to act on. A normal, non-error path:
   * the person picks their transition by hand instead.
   */
  | { kind: 'needs_picker'; reason: string }
  /**
   * Either the gate flagged the input, or the check could not be completed.
   * The two are deliberately indistinguishable to the caller so that no
   * screen can treat a technical failure as permission to continue.
   */
  | { kind: 'diverted' };

function asStateCurrent(value: unknown): StateCurrent | null {
  return typeof value === 'string' && (STATES_CURRENT as readonly string[]).includes(value)
    ? (value as StateCurrent)
    : null;
}

function asStateTarget(value: unknown): StateTarget | null {
  return typeof value === 'string' && (STATES_TARGET as readonly string[]).includes(value)
    ? (value as StateTarget)
    : null;
}

/**
 * Runs free text through the server-side gate.
 *
 * The text is passed to the Edge Function and nowhere else. It is not logged,
 * not stored, and not attached to any event — here or in the caller.
 */
export async function checkAndInterpret(
  text: string,
  userId: string | null
): Promise<SafetyOutcome> {
  if (!isSupabaseConfigured) {
    // No server means no gate. That is a fail-closed condition, not a reason
    // to fall back to something local.
    return { kind: 'diverted' };
  }

  let raw: unknown;
  try {
    raw = await callInterpret(text, userId);
  } catch {
    return { kind: 'diverted' };
  }

  const result = raw as InterpretResult | null;
  if (!result || typeof result !== 'object' || !('route' in result)) {
    return { kind: 'diverted' };
  }

  if (result.route === 'support') return { kind: 'diverted' };

  if (result.route === 'picker') {
    return { kind: 'needs_picker', reason: String(result.reason ?? 'unknown') };
  }

  if (result.route !== 'session') return { kind: 'diverted' };

  // A `session` result still has to survive validation against the closed
  // vocabularies. Anything unexpected is treated as a failed check.
  const transitionKey = result.transition_key;
  const stateCurrent = asStateCurrent(result.state_current);
  const stateTarget = asStateTarget(result.state_target);

  if (
    !isTransitionKey(transitionKey) ||
    !stateCurrent ||
    !stateTarget ||
    typeof result.session_id !== 'string' ||
    !Number.isFinite(result.duration_seconds)
  ) {
    return { kind: 'diverted' };
  }

  return {
    kind: 'interpreted',
    interpretation: {
      transitionKey,
      sessionId: result.session_id,
      durationSeconds: Number(result.duration_seconds),
      stateCurrent,
      stateTarget,
      contextTag: typeof result.context_tag === 'string' ? result.context_tag : null,
      origin: 'interpreted',
    },
  };
}
