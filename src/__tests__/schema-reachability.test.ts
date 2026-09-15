/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * SCHEMA REACHABILITY.
 *
 * A migration can create a table, lock it down correctly, and be completely
 * dead — because nothing ever writes to it. That failure is invisible: the
 * migration applies, the tests pass, the RLS probes return the right codes, and
 * the feature it exists for silently cannot work.
 *
 * Three objects were in exactly that state before this suite existed:
 *
 *   session_manifests.fingerprint       added, never written
 *   intervention_module_versions        created, never written
 *   saved_sessions                      created, never written
 *
 * The first two were reachable defects and are fixed. The third is not a
 * defect: nothing saves a session yet because the saved-session journey is not
 * in V1 scope, and inventing a writer for it would be inventing product.
 *
 * WHAT THIS SUITE IS FOR. Every persistent object should either have a writer
 * or be recorded here as deliberately unwritten. It is a guard against the
 * quiet version of "built": schema that exists and cannot be used.
 */

const root = join(__dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

const COMPOSER = read('supabase', 'functions', 'compose', 'index.ts');
const SHARED_COMPOSE = read('supabase', 'functions', '_shared', 'compose.ts');
const IMPORTER = read('scripts', 'modules-import.mjs');
const VALIDATOR = read('scripts', 'modules-validate.mjs');
const RPC = read('supabase', 'migrations', '20260909180000_persist_fingerprint.sql');
const NOVELTY_MIGRATION = read(
  'supabase',
  'migrations',
  '20260909160000_novelty_and_saved_sessions.sql'
);

describe('session_manifests.fingerprint is reachable', () => {
  it('the persistence RPC accepts a fingerprint', () => {
    expect(RPC).toContain('p_fingerprint text default null');
  });

  it('the RPC actually writes it to the column', () => {
    // Accepting a parameter and dropping it would be the same defect wearing a
    // different hat, so the insert column list is checked directly.
    const insert = RPC.slice(RPC.indexOf('insert into session_manifests'));
    expect(insert.slice(0, 300)).toContain('fingerprint');
    expect(insert.slice(0, 400)).toContain('p_fingerprint');
  });

  it('the old signature is dropped, not left as an overload', () => {
    // `create or replace` with a different argument list creates a SECOND
    // function. Two candidates make the call ambiguous and every persist would
    // fail at runtime.
    expect(RPC).toContain(
      'drop function if exists persist_session_manifest(uuid, text, integer, integer, integer, jsonb)'
    );
  });

  it('the composer computes a fingerprint and passes it', () => {
    expect(COMPOSER).toContain('manifestFingerprint');
    expect(COMPOSER).toContain('p_fingerprint: fingerprint');
  });

  it('the fingerprint is built from real module versions, not a default', () => {
    // `manifestFingerprint` defaults every version to 1 when given no map.
    // Passing the real versions is what makes replaced audio produce a
    // different identity.
    expect(COMPOSER).toContain('row.version');
    expect(COMPOSER).toMatch(/manifestFingerprint\(manifest,\s*versions\)/);
  });

  it('selects version from the library so the map is not empty', () => {
    const select = COMPOSER.slice(COMPOSER.indexOf('from("intervention_modules")'));
    expect(select.slice(0, 400)).toContain('version');
  });

  it('the RPC stays service-role only', () => {
    for (const role of ['public', 'anon', 'authenticated']) {
      expect(RPC).toContain(`jsonb, text) from ${role}`);
    }
  });
});

describe('recency is applied, and bounded by what was decided', () => {
  /**
   * THIS BLOCK USED TO ASSERT THE OPPOSITE, and was right to at the time: while
   * the lookback and weighting were undecided, applying them would have been
   * inventing a product decision, so the composer computed a fingerprint and
   * did nothing with it.
   *
   * Novelty is now activated (§6z). What has NOT changed is that the policy
   * numbers remain defaults rather than decisions — so the tests move from
   * "recency must not be applied" to "recency must not be able to override
   * evidence", which is the invariant that actually protects anybody.
   */
  it('the composer applies recency to its scores', () => {
    expect(SHARED_COMPOSE).toContain('applyRecency');
  });

  it('it reads a bounded window of recent history', () => {
    // Unbounded history would be a growing query on every composition, and a
    // penalty that decays to nothing has no use for the sixth session back.
    expect(COMPOSER).toContain('DEFAULT_NOVELTY.lookbackSessions');
    expect(COMPOSER).toContain('.limit(');
  });

  it('effectiveness is computed first and recency layered on top', () => {
    expect(SHARED_COMPOSE).toContain('applyRecency(scoresFrom(');
  });

  it('the policy numbers are still labelled as undecided', () => {
    const novelty = read('supabase', 'functions', '_shared', 'novelty.ts');
    expect(novelty).toContain('PRODUCT DECISION THAT HAS NOT BEEN MADE');
  });

  it('recency cannot bury a module that works for somebody', () => {
    // Rule 8. Enforced in novelty-replay.test.ts against real arithmetic; here
    // what matters is that the bound exists at all.
    const novelty = read('supabase', 'functions', '_shared', 'novelty.ts');
    expect(novelty).toContain('MOST RECENT OCCURRENCE ONLY');
    expect(novelty).toContain('penaltyFloor');
  });

  it('isRecentlySeen is still not wired', () => {
    // Retrying an identical composition is a different mechanism and was not
    // part of activating recency weighting.
    expect(COMPOSER).not.toContain('isRecentlySeen');
  });
});

describe('intervention_module_versions is reachable', () => {
  it('the importer writes a version row per module', () => {
    expect(IMPORTER).toContain('intervention_module_versions');
    expect(IMPORTER).toContain('module_id: row.id');
  });

  it('writes the version rows from what the database returned, not the input', () => {
    // The module ids only exist after the insert. Building version rows from
    // the manifest instead would have no id to reference.
    expect(IMPORTER).toContain('const imported = JSON.parse(result.body)');
    expect(IMPORTER).toContain('return=representation');
  });

  it('treats a re-import of an unchanged version as a duplicate, not an error', () => {
    // The table is append-only. Re-running the importer must be safe, or the
    // dry-run-then-commit workflow breaks on the second use.
    // Gained a locale in the multilingual pass: version numbers run per
    // language, so Spanish version 1 is not English version 1.
    expect(IMPORTER).toContain('on_conflict=module_id,locale,version');
    // Was ignore-duplicates, which skipped an existing row entirely and so
    // could never record content approval onto one. Now merges -- safe because
    // the append-only trigger still refuses any real mutation. See
    // version-approval.test.ts.
    expect(IMPORTER).toContain('resolution=merge-duplicates');
  });

  it('fails loudly if the history cannot be written', () => {
    // Silently importing modules without their version history would destroy
    // the record irrecoverably: once the module row moves on, the previous
    // storage path and duration are gone.
    expect(IMPORTER).toContain('the version history was not');
    expect(IMPORTER.slice(IMPORTER.indexOf('the version history was not'))).toContain(
      'process.exit(1)'
    );
  });

  it('writes no rendition for a module with no audio', () => {
    // A rendition is a recording. One written for audio that does not exist is a
    // row pointing at nothing, and it makes "which modules have been recorded?"
    // unanswerable, because every module would appear to have one.
    expect(IMPORTER).toContain('const recorded = new Set(plan.filter((p) => p.audio)');
    expect(IMPORTER).toContain('.filter((row) => recorded.has(row.module_key))');
  });

  it('does not send an empty rendition request', () => {
    expect(IMPORTER).toContain('renditionRows.length === 0');
  });

  it('says so rather than reporting silence', () => {
    expect(IMPORTER).toContain('No renditions written - no audio was supplied.');
  });

  it('carries a version on the module row so history can advance', () => {
    expect(IMPORTER).toContain('version: m.version ?? 1');
  });

  it('the validator rejects a malformed version', () => {
    expect(VALIDATOR).toContain('version, if given, must be a positive integer');
  });

  it('the table it writes to is append-only', () => {
    expect(NOVELTY_MIGRATION).toContain('append-only');
    expect(NOVELTY_MIGRATION).toContain('intervention_module_versions_immutable');
  });
});

describe('objects deliberately left unwritten', () => {
  /**
   * Recorded rather than fixed. `saved_sessions` has no writer because nothing
   * in V1 saves a session — the saved/replay journey has not been scoped in,
   * and building a writer for it would be adding a feature nobody asked for.
   *
   * This test exists so the absence stays a decision instead of decaying into
   * an oversight.
   */
  it('saved_sessions exists, is locked down, and has no writer yet', () => {
    expect(NOVELTY_MIGRATION).toContain('create table if not exists saved_sessions');
    expect(NOVELTY_MIGRATION).toContain('saved_sessions_own_insert');

    const clientAndServer = [COMPOSER, IMPORTER].join('\n');
    expect(clientAndServer).not.toContain('saved_sessions');
  });
});
