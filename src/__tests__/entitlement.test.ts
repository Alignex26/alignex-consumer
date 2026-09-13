/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  FREE_SESSION_ALLOWANCE,
  PREMIUM,
  gateFor,
  type EntitlementState,
} from '../lib/entitlement';

/**
 * ENTITLEMENT.
 *
 * The three decisions that blocked this module for its whole life — pricing,
 * trial and free allowance — are made:
 *
 *     free      3 complete sessions, LIFETIME, per account
 *     monthly   USD 9.99
 *     annual    USD 49.99
 *
 * What matters here is not that the numbers arrived. It is that the access
 * decision cannot be taken by the client, that the trial cannot be reset by
 * reinstalling, and that a failure nobody caused does not cost somebody a third
 * of their trial.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

const MIGRATION = read('supabase', 'migrations', '20260913100000_entitlements_and_free_sessions.sql');
const ENTITLEMENT = read('src', 'lib', 'entitlement.ts');

const state = (over: Partial<EntitlementState> = {}): EntitlementState => ({
  premium: false,
  status: 'none',
  periodEnd: null,
  freeUsed: 0,
  freeRemaining: FREE_SESSION_ALLOWANCE,
  mayStart: true,
  unknown: false,
  ...over,
});

describe('the commercial terms are the agreed ones', () => {
  it('three free sessions, and the entitlement is store-agnostic', () => {
    expect(FREE_SESSION_ALLOWANCE).toBe(3);
    expect(PREMIUM).toBe('premium');
  });

  it('the server enforces the same three, not the client', () => {
    // A client constant the server did not share would be a suggestion.
    expect(MIGRATION).toContain('greatest(0, 3 - v_used)');
  });

  it('no price is used in code', () => {
    // Displayed prices come from the store, localised, at runtime. A hardcoded
    // one ships stale and is wrong everywhere outside one country.
    //
    // Checked against CODE, not comments: the module's documentation records
    // what the product intends to charge, which is worth having written down
    // next to the thing that enforces it. What must not exist is a price a
    // screen could render.
    const code = ENTITLEMENT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/9\.99|49\.99/);
    expect(code).not.toMatch(/\$\s*\d/);
    expect(code).not.toContain('USD');
  });
});

describe('the gate', () => {
  it('lets a premium subscriber through', () => {
    expect(gateFor(state({ premium: true, status: 'active' })))
      .toEqual({ action: 'allow', reason: 'premium' });
  });

  it('lets somebody with trial left through', () => {
    expect(gateFor(state({ freeRemaining: 1, freeUsed: 2 })))
      .toEqual({ action: 'allow', reason: 'free_session' });
  });

  it('shows the paywall when the trial is spent', () => {
    expect(gateFor(state({ freeRemaining: 0, freeUsed: 3 })))
      .toEqual({ action: 'paywall', reason: 'free_exhausted' });
  });

  it('distinguishes a lapsed subscriber from a spent trial', () => {
    // They are different people and the copy differs.
    for (const status of ['expired', 'cancelled'] as const) {
      expect(gateFor(state({ freeRemaining: 0, status })))
        .toEqual({ action: 'paywall', reason: 'expired' });
    }
  });

  it('keeps access during grace and a billing issue', () => {
    // Access is retained while the store retries. Losing the product the
    // moment a card expires is how a renewal becomes a cancellation.
    for (const status of ['grace', 'billing_issue'] as const) {
      expect(gateFor(state({ premium: true, status })).action).toBe('allow');
    }
  });

  it('keeps access after cancelling, until the period ends', () => {
    // Somebody who cancels on day two of an annual subscription has paid for
    // the year.
    const future = new Date(Date.now() + 86_400_000);
    expect(gateFor(state({ premium: true, status: 'cancelled', periodEnd: future })).action)
      .toBe('allow');
  });
});

describe('an unreachable server fails in the right direction', () => {
  it('allows the session', () => {
    // Somebody on a train mid-trial should get their session.
    expect(gateFor(state({ unknown: true, freeRemaining: 0 })))
      .toEqual({ action: 'allow', reason: 'unknown' });
  });

  it('but grants no premium', () => {
    // Nobody gets the paid product by turning off wifi.
    const offline = state({ unknown: true });
    expect(offline.premium).toBe(false);
    expect(gateFor(offline).reason).not.toBe('premium');
  });

  it('and the allowance is still counted when the report lands', () => {
    // The ledger is written server-side on completion, so an offline session
    // is not a free one.
    expect(ENTITLEMENT).toContain('consumeFreeSession');
    expect(MIGRATION).toContain('insert into free_session_ledger');
  });
});

describe('the trial cannot be reset, or double-charged', () => {
  it('the ledger is keyed to the account, not the device', () => {
    expect(MIGRATION).toContain('references auth.users (id) on delete cascade');
  });

  it('one run can consume at most one allowance', () => {
    // Enforced by the database rather than by a caller remembering to check.
    expect(MIGRATION).toContain('run_id      uuid        not null unique');
    expect(MIGRATION).toContain('on conflict (run_id) do nothing');
  });

  it('the client cannot write either table', () => {
    // Read your own; write neither. A client that could insert could grant
    // itself the product.
    expect(MIGRATION).toContain('free_sessions_own_select');
    expect(MIGRATION).toContain('entitlements_own_select');
    expect(MIGRATION).not.toMatch(/for insert to authenticated/);
    expect(MIGRATION).not.toMatch(/for update to authenticated/);
  });

  it('both tables have row-level security on', () => {
    expect(MIGRATION).toContain('alter table free_session_ledger enable row level security');
    expect(MIGRATION).toContain('alter table entitlements enable row level security');
  });

  it('the consuming function verifies ownership itself', () => {
    expect(MIGRATION).toContain('raise exception \'run does not belong to the caller\'');
  });
});

describe('a failure nobody caused does not cost a free session', () => {
  it('only a genuinely completed run consumes one', () => {
    // Asserted against the row, not believed from the argument. Safety
    // diversion, locale_unavailable, library_empty and any backend failure
    // never reach a completed run, so none of them consumes anything.
    expect(MIGRATION).toContain('if not v_run.completed then');
    expect(MIGRATION).toContain('raise exception \'run is not complete\'');
  });

  it('the exclusions are written down where the rule lives', () => {
    for (const excluded of ['safety diversion', 'locale_unavailable', 'library_empty']) {
      expect(MIGRATION).toContain(excluded);
    }
  });

  it('a premium subscriber consumes nothing at all', () => {
    // A subscription starting mid-trial must not keep burning allowances.
    const block = MIGRATION.slice(MIGRATION.indexOf('Premium consumes nothing'));
    expect(block.slice(0, 500)).toContain('return null');
  });
});

describe('access is decided server-side, in one place', () => {
  it('the state comes from a single RPC', () => {
    expect(ENTITLEMENT).toContain("rpc('elsea_entitlement_state')");
  });

  it('the app does not assemble entitlement from parts', () => {
    // Every part it assembled itself would be a part it could get wrong in its
    // own favour.
    expect(MIGRATION).toContain('may_start      := premium or free_remaining > 0');
  });

  it('both functions are security definer and not public', () => {
    expect(MIGRATION).toContain('security definer');
    expect(MIGRATION).toContain('revoke all on function elsea_consume_free_session(uuid) from public');
    expect(MIGRATION).toContain('revoke all on function elsea_entitlement_state() from public');
  });

  it('the access decision never reads the product id', () => {
    // Store-agnostic: a promotional grant or a second store needs no change.
    const decision = MIGRATION.slice(MIGRATION.indexOf('create or replace function elsea_entitlement_state'));
    expect(decision).not.toContain('product_id =');
    expect(decision).not.toContain('store =');
  });
});
