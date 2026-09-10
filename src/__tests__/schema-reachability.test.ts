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

describe('recording is not the same as applying a policy', () => {
  /**
   * The distinction this whole change rests on. Storing what was composed is
   * bookkeeping. Deprioritising a module because it was heard recently is a
   * product decision — the lookback window and the novelty-versus-
   * effectiveness weighting are not decided, and the defaults in
   * `novelty.ts` are explicitly placeholders.
   *
   * So the composer may compute a fingerprint and must not apply recency.
   */
  it('the composer does not apply recency', () => {
    expect(COMPOSER).not.toContain('applyRecency');
    expect(COMPOSER).not.toContain('DEFAULT_NOVELTY');
    expect(COMPOSER).not.toContain('isRecentlySeen');
  });

  it('the composer does not read a person’s recent fingerprints', () => {
    // Reading history back is the activation step, and it is not taken here.
    expect(COMPOSER).not.toMatch(/select\([^)]*fingerprint/);
  });

  it('no novelty policy constant is used in the composer', () => {
    expect(COMPOSER).not.toContain('lookbackSessions');
    expect(COMPOSER).not.toContain('maxPenalty');
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
    expect(IMPORTER).toContain('resolution=ignore-duplicates');
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
