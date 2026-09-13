import { getSupabase } from './supabase';

/**
 * Entitlement — whether someone may start another session.
 *
 * THE THREE DECISIONS THAT USED TO BLOCK THIS ARE MADE:
 *
 *     free      3 complete sessions, LIFETIME, per account
 *     monthly   USD 9.99
 *     annual    USD 49.99   (primary offer)
 *     paid      unlimited legitimate use
 *
 * SERVER TRUTH, ALWAYS. Every field below comes from `elsea_entitlement_state()`
 * in one round trip. Nothing here derives entitlement from a receipt the app
 * parsed, a counter it kept, or a subscription object a vendor SDK handed it —
 * all three survive neither a reinstall nor someone who wants them not to.
 *
 * NO PRICES IN THIS FILE. Displayed prices come from the store, localised, at
 * runtime. The figures above are the product's intent and belong in
 * configuration and the store consoles, not in a string a build might ship
 * stale. See `docs/commercial-configuration.md`.
 *
 * WHAT THE APP MAY DO WHEN THIS FAILS. Fail closed on paid access, open on
 * refusal: an unreachable server must not silently grant premium, and must not
 * lock out somebody mid-trial either. `unknown()` is the shape for that, and the
 * caller decides — see `mayStart`.
 */

/** The only entitlement. Store-agnostic on purpose. */
export const PREMIUM = 'premium' as const;

/** Free sessions granted per account, for the lifetime of the account. */
export const FREE_SESSION_ALLOWANCE = 3;

/**
 * What the customer is experiencing, in the product's own words.
 *
 * A provider that spells these differently is mapped at the boundary; nothing
 * above this line learns a vendor's vocabulary.
 */
export type EntitlementStatus =
  /** No subscription has ever existed. */
  | 'none'
  /** Paying, or inside an introductory period. */
  | 'active'
  /** Payment failed; the store is retrying and access is retained. */
  | 'grace'
  /** Payment failed; access retained, but the customer must act. */
  | 'billing_issue'
  /** Will not renew. Access continues until the period ends — it was paid for. */
  | 'cancelled'
  /** Access has ended. */
  | 'expired';

export type EntitlementState = {
  premium: boolean;
  status: EntitlementStatus;
  /** When paid access ends. Null for a subscription with no scheduled end. */
  periodEnd: Date | null;
  freeUsed: number;
  freeRemaining: number;
  /** Whether a session may start now. */
  mayStart: boolean;
  /** True when the server could not be reached and this is a safe assumption. */
  unknown: boolean;
};

/**
 * The answer when the server cannot be reached.
 *
 * ALLOWS A SESSION, GRANTS NO PREMIUM. Somebody on a train mid-trial should get
 * their session; nobody should get the paid product by turning off wifi. The
 * ledger is written server-side on completion, so an allowance consumed offline
 * is still counted when the report lands.
 */
function unknownState(): EntitlementState {
  return {
    premium: false,
    status: 'none',
    periodEnd: null,
    freeUsed: 0,
    freeRemaining: FREE_SESSION_ALLOWANCE,
    mayStart: true,
    unknown: true,
  };
}

/** Reads the current state. One round trip, decided server-side. */
export async function fetchEntitlement(): Promise<EntitlementState> {
  const supabase = getSupabase();
  if (!supabase) return unknownState();

  const { data, error } = await supabase.rpc('elsea_entitlement_state');
  if (error || !data) return unknownState();

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return unknownState();

  return {
    premium: Boolean(row.premium),
    status: (row.status ?? 'none') as EntitlementStatus,
    periodEnd: row.period_end ? new Date(row.period_end) : null,
    freeUsed: Number(row.free_used ?? 0),
    freeRemaining: Number(row.free_remaining ?? 0),
    mayStart: Boolean(row.may_start),
    unknown: false,
  };
}

/**
 * Records that a completed run consumed a free session.
 *
 * IDEMPOTENT, AND NOT TRUSTED. The run id is checked server-side against the
 * caller's own completed runs, so reporting a run that did not complete, or
 * reporting the same one twice, changes nothing. Premium consumes nothing.
 *
 * WHY THE CLIENT REPORTS IT AT ALL. The alternative — a trigger on
 * `user_sessions.completed` — would consume an allowance for a run marked
 * complete by a path that never played audio. Completion is asserted by the
 * thing that watched the playback finish.
 *
 * Returns the remaining allowance, or null for a premium subscriber.
 */
export async function consumeFreeSession(runId: string): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('elsea_consume_free_session', {
    p_run_id: runId,
  });

  if (error) return null;
  return data === null ? null : Number(data);
}

/**
 * What the app should do next, given a state.
 *
 * Kept separate from the fetch so it can be reasoned about, and tested, without
 * a network.
 */
export type EntitlementGate =
  /** Start the session. */
  | { action: 'allow'; reason: 'premium' | 'free_session' | 'unknown' }
  /** Show the paywall. */
  | { action: 'paywall'; reason: 'free_exhausted' | 'expired' };

export function gateFor(state: EntitlementState): EntitlementGate {
  if (state.unknown) return { action: 'allow', reason: 'unknown' };
  if (state.premium) return { action: 'allow', reason: 'premium' };
  if (state.freeRemaining > 0) return { action: 'allow', reason: 'free_session' };

  // Somebody who has subscribed before and lapsed sees the paywall for a
  // different reason than somebody who has simply used their trial, and the
  // copy differs.
  const lapsed = state.status === 'expired' || state.status === 'cancelled';
  return { action: 'paywall', reason: lapsed ? 'expired' : 'free_exhausted' };
}
