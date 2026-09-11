/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

import { forbidden, isOperator } from '../../supabase/functions/_shared/operator-auth';

/**
 * OPERATOR AUTHORISATION.
 *
 * These functions can spend money. What guards them therefore has to be tested
 * on the thing that actually decides — the `role` claim — and not merely on the
 * shape of the code around it.
 *
 * THE INVARIANT THIS RESTS ON. Reading a claim is only safe because the Supabase
 * gateway verifies the token's signature before the function runs. That is true
 * of every function with `verify_jwt = true`, which is the default and which
 * both operator functions use. `interpret` is explicitly `verify_jwt = false`
 * and must never adopt this helper — a hand-crafted token would be believed.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

const HELPER = read('supabase', 'functions', '_shared', 'operator-auth.ts');
const GENERATE = read('supabase', 'functions', 'generate-master', 'index.ts');
const CHECK = read('supabase', 'functions', 'voice-check', 'index.ts');
const CONFIG = read('supabase', 'config.toml');

/** A token shaped exactly as Supabase issues one. Signature is never read. */
const jwt = (payload: Record<string, unknown>) => {
  const b64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.fakesignature`;
};

const withAuth = (header: string | null) =>
  new Request('https://example.test/', {
    method: 'POST',
    headers: header === null ? {} : { Authorization: header },
  });

describe('only service_role passes', () => {
  it('accepts a service_role token', () => {
    expect(isOperator(withAuth(`Bearer ${jwt({ role: 'service_role' })}`))).toBe(true);
  });

  it('rejects anon', () => {
    // The key that ships in the app bundle.
    expect(isOperator(withAuth(`Bearer ${jwt({ role: 'anon' })}`))).toBe(false);
  });

  it('rejects an authenticated user', () => {
    expect(isOperator(withAuth(`Bearer ${jwt({ role: 'authenticated', sub: 'user-1' })}`))).toBe(false);
  });

  it('rejects a token with no role claim', () => {
    expect(isOperator(withAuth(`Bearer ${jwt({ sub: 'user-1', iss: 'supabase' })}`))).toBe(false);
  });

  it('rejects a role that merely looks close', () => {
    for (const role of ['Service_Role', 'service_role ', ' service_role', 'service-role', 'servicerole']) {
      expect(isOperator(withAuth(`Bearer ${jwt({ role })}`))).toBe(false);
    }
  });

  it('rejects a non-string role', () => {
    for (const role of [1, true, null, ['service_role'], { role: 'service_role' }]) {
      expect(isOperator(withAuth(`Bearer ${jwt({ role })}`))).toBe(false);
    }
  });
});

describe('malformed input fails closed', () => {
  it('rejects a missing Authorization header', () => {
    expect(isOperator(withAuth(null))).toBe(false);
  });

  it('rejects an empty header', () => {
    expect(isOperator(withAuth(''))).toBe(false);
  });

  it('rejects a non-Bearer scheme', () => {
    expect(isOperator(withAuth(`Basic ${jwt({ role: 'service_role' })}`))).toBe(false);
  });

  it('rejects Bearer with no token', () => {
    expect(isOperator(withAuth('Bearer'))).toBe(false);
    expect(isOperator(withAuth('Bearer '))).toBe(false);
  });

  it('rejects a token that is not three segments', () => {
    expect(isOperator(withAuth('Bearer not-a-jwt'))).toBe(false);
    expect(isOperator(withAuth('Bearer one.two'))).toBe(false);
    expect(isOperator(withAuth('Bearer one.two.three.four'))).toBe(false);
  });

  it('rejects a payload that is not valid base64 or not JSON', () => {
    expect(isOperator(withAuth('Bearer aaa.!!!!.ccc'))).toBe(false);
    const notJson = Buffer.from('plain text').toString('base64url');
    expect(isOperator(withAuth(`Bearer aaa.${notJson}.ccc`))).toBe(false);
  });

  it('rejects a payload that decodes to a non-object', () => {
    // A JSON payload can legally be a string, number, array or null. None of
    // them can carry claims, and none must be treated as though it did.
    for (const value of ['"service_role"', '42', 'null', '["service_role"]']) {
      const seg = Buffer.from(value).toString('base64url');
      expect(isOperator(withAuth(`Bearer aaa.${seg}.ccc`))).toBe(false);
    }
  });

  it('never throws, whatever token it is given', () => {
    // Token-level garbage only. A whitespace-only Authorization VALUE is
    // rejected by the Request constructor before the helper ever sees it, so
    // including one would test the fetch implementation rather than this code.
    for (const header of [
      'Bearer ...',
      'Bearer .',
      'Bearer a.b.c',
      'Bearer ..',
      'Bearer a..c',
      'Bearer %%%.%%%.%%%',
      `Bearer ${'x'.repeat(4096)}`,
    ]) {
      expect(() => isOperator(withAuth(header))).not.toThrow();
      expect(isOperator(withAuth(header))).toBe(false);
    }
  });
});

describe('base64url is decoded correctly', () => {
  it('handles a payload needing padding restored', () => {
    // JWTs strip '=' padding and use -/_ instead of +/. Getting this wrong
    // fails closed — which would look like security and would reject every
    // valid operator too.
    for (const extra of ['', 'a', 'ab', 'abc', 'abcd']) {
      const token = jwt({ role: 'service_role', pad: extra });
      expect(token).not.toContain('=');
      expect(isOperator(withAuth(`Bearer ${token}`))).toBe(true);
    }
  });

  it('handles a payload containing base64url-specific characters', () => {
    // Values that push '+' and '/' into the encoding, which must become '-'/'_'.
    const token = jwt({ role: 'service_role', note: '???>>>~~~ùùù' });
    expect(isOperator(withAuth(`Bearer ${token}`))).toBe(true);
  });
});

describe('the defect is gone', () => {
  it('no function compares a bearer token to an environment key', () => {
    // The original failure: a correctly signed service_role token was rejected
    // because it was not byte-identical to SUPABASE_SERVICE_ROLE_KEY.
    const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const source of [GENERATE, CHECK]) {
      expect(code(source)).not.toContain('Bearer ${SERVICE_ROLE_KEY}');
      expect(code(source)).not.toContain('auth !==');
    }
  });

  it('both operator functions use the shared helper', () => {
    for (const source of [GENERATE, CHECK]) {
      expect(source).toContain('from "../_shared/operator-auth.ts"');
      expect(source).toContain('if (!isOperator(req)) return forbidden();');
    }
  });

  it('the helper compares no secret at all', () => {
    const code = HELPER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('SERVICE_ROLE_KEY');
    expect(code).not.toContain('Deno.env');
  });

  it('the helper logs nothing', () => {
    expect(HELPER).not.toContain('console.');
  });
});

describe('the gateway invariant is documented and holds', () => {
  it('the helper states loudly what it depends on', () => {
    expect(HELPER).toContain('verify_jwt = false');
    expect(HELPER).toContain('DO NOT USE THIS ON A FUNCTION WITH');
  });

  it('neither operator function disables verify_jwt', () => {
    // Absence of a [functions.*] block means the default, which is true.
    expect(CONFIG).not.toContain('[functions.generate-master]');
    expect(CONFIG).not.toContain('[functions.voice-check]');
  });

  it('only interpret is verify_jwt = false, and it does not use the helper', () => {
    expect(CONFIG).toContain('[functions.interpret]');
    const interpret = read('supabase', 'functions', 'interpret', 'index.ts');
    expect(interpret).not.toContain('operator-auth');
  });
});

describe('the refusal says nothing useful to an attacker', () => {
  it('is a plain 403 with no detail', async () => {
    const response = forbidden();
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ ok: false, failure: 'forbidden' });
  });

  it('does not distinguish why it failed', () => {
    // anon, a bad payload and a missing header all return the same thing.
    // Telling a caller which part of their token was wrong tells them how to
    // fix it.
    //
    // Checked against the RESPONSE, not the source: the helper's documentation
    // discusses malformed payloads at length, and that prose must not satisfy
    // or fail this test.
    const body = JSON.stringify({ ok: false, failure: 'forbidden' });
    expect(body).not.toContain('invalid_role');
    expect(body).not.toContain('malformed');
    expect(body).not.toContain('role');

    // And the helper returns a bare boolean, so it has no way to leak a reason
    // even if somebody wanted it to.
    expect(isOperator(withAuth(`Bearer ${jwt({ role: 'anon' })}`))).toBe(false);
    expect(isOperator(withAuth('Bearer nonsense'))).toBe(false);
  });
});
