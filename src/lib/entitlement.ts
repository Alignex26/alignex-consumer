/**
 * Entitlement — whether someone may start another session.
 *
 * CONFIGURATION REQUIRED: RevenueCat is not installed or configured in this
 * project, and there is no entitlement table in the schema. There is therefore
 * nothing to ask.
 *
 * PRODUCT DECISION REQUIRED — PRICING
 * PRODUCT DECISION REQUIRED — TRIAL
 * PRODUCT DECISION REQUIRED — FREE ALLOWANCE
 *
 * None of those three has been decided, so none of them is invented here. This
 * module is the boundary the rest of the app asks, so that wiring a real
 * provider later is a change to this file and nothing else.
 *
 * `DEV_FREE_ALLOWANCE` is explicitly a development fixture, not a product
 * decision, and is kept apart from anything that could be mistaken for
 * configuration. While `ENTITLEMENT_ENFORCED` is false — which is its shipped
 * value — nothing is gated at all and the free-limit screen is unreachable in
 * normal use.
 */

/**
 * Turn on only to exercise the free-limit path in development. Enforcing an
 * allowance nobody has agreed would be inventing a commercial term.
 */
export const ENTITLEMENT_ENFORCED = false;

/** Development fixture. Has no product meaning. */
export const DEV_FREE_ALLOWANCE = 3;

export type Entitlement = {
  /** Whether another session may be started. */
  allowed: boolean;
  /** Null whenever no allowance is being enforced. */
  remaining: number | null;
};

/**
 * Asks whether a session may start.
 *
 * With no provider configured this answers yes, always — the correct behaviour
 * when there is no agreed allowance to enforce. It takes the person's own
 * completed-run count so that the development path can be exercised without
 * a client-side counter being invented as the production mechanism.
 */
export function checkEntitlement(completedRuns: number): Entitlement {
  if (!ENTITLEMENT_ENFORCED) {
    return { allowed: true, remaining: null };
  }

  const remaining = Math.max(0, DEV_FREE_ALLOWANCE - completedRuns);
  return { allowed: remaining > 0, remaining };
}
