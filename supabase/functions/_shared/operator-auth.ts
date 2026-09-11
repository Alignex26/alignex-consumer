/**
 * OPERATOR AUTHORISATION for Edge Functions.
 *
 * ===========================================================================
 * THIS IS SAFE ONLY BECAUSE THE GATEWAY VERIFIES THE SIGNATURE FIRST.
 *
 * Supabase validates the JWT before a function with `verify_jwt = true` is
 * invoked. By the time this code runs, the token's signature has already been
 * checked against the project's secret, so its claims can be trusted.
 *
 * **DO NOT USE THIS ON A FUNCTION WITH `verify_jwt = false`.** There, anyone
 * could hand-craft a token claiming `role: "service_role"` and this would
 * believe it. `interpret` is the one function in this project configured that
 * way, and it must never adopt this helper.
 * ===========================================================================
 *
 * WHAT THIS REPLACED, AND WHY. The previous check compared the Authorization
 * header byte-for-byte against `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`:
 *
 *     if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) → 403
 *
 * That is the wrong mechanism, and it failed in production. It assumes the
 * token a caller holds is byte-identical to whatever Supabase injects into that
 * variable — which is not guaranteed, varies with the project's key generation,
 * and breaks silently when it changes. A correctly signed service_role token
 * was rejected with 403 while the gateway had already accepted it.
 *
 * Authorisation is a question about IDENTITY, not about string equality with a
 * secret. The identity is in the `role` claim, which is what this reads.
 *
 * It also means no secret is ever compared, so no secret can be timing-leaked
 * or accidentally logged by this path.
 */

/** Roles Supabase issues. Only one of them operates ELSEA. */
const OPERATOR_ROLE = "service_role";

/**
 * Decodes a JWT payload.
 *
 * JWTs use base64url — `-` and `_` rather than `+` and `/`, and no padding —
 * so `atob` cannot be given the segment directly. Getting this wrong produces a
 * parse failure rather than a wrong answer, which fails closed, but it would
 * fail closed for every valid token too.
 *
 * Returns null on anything malformed. Never throws: a caller must not have to
 * wrap an authorisation check in a try/catch to be safe.
 */
function decodePayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // Restore the padding `atob` requires.
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded));
    // A JSON payload can legally be a string, a number or null. Only an object
    // can carry claims.
    return decoded !== null && typeof decoded === "object" && !Array.isArray(decoded)
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Whether this request comes from an operator.
 *
 * True only for a verified token whose `role` claim is exactly
 * `service_role`. `anon`, `authenticated`, a missing role, a malformed payload,
 * a missing header and a non-Bearer scheme all fail closed.
 *
 * The token is never logged, and nothing about it is returned.
 */
export function isOperator(req: Request): boolean {
  const header = req.headers.get("Authorization");
  if (!header) return false;

  // Case-insensitive scheme, exactly as HTTP specifies, but the token itself is
  // taken verbatim.
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;

  const payload = decodePayload(match[1]);
  if (!payload) return false;

  return payload.role === OPERATOR_ROLE;
}

/** The refusal, shaped like every other failure these functions return. */
export function forbidden(): Response {
  return new Response(JSON.stringify({ ok: false, failure: "forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
