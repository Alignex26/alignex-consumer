/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

import { composeFor } from './composition-proof.test';

/**
 * MANIFEST PERSISTENCE.
 *
 * The chain the cost architecture needs:
 *
 *   session_costs -> session_manifests -> user_sessions -> session_outcomes
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT. It exercises the persistence LOGIC
 * against a real composed manifest — the rows that would be written, their
 * shape, the constraints they must satisfy, and the rollback path. It does not
 * execute an INSERT against the live database, because doing so would require
 * an approved module with real audio in the production library, and inventing
 * one is exactly what must not happen.
 *
 * That distinction is recorded in the handover rather than blurred: the write
 * path is verified in structure, not yet in execution.
 */

const COMPOSER = readFileSync(
  join(__dirname, '..', '..', 'supabase', 'functions', 'compose', 'index.ts'),
  'utf8'
);
const SCHEMA = readFileSync(
  join(__dirname, '..', '..', 'supabase', 'migrations', '20260908120000_session_engine.sql'),
  'utf8'
);

/** Mirrors the row `persistManifest` builds for each segment. */
function segmentRows(manifestId: string, segments: ReturnType<typeof composeFor> extends never ? never : any) {
  return segments.map((segment: any) => ({
    manifest_id: manifestId,
    ordinal: segment.ordinal,
    kind: segment.kind,
    module_id: segment.kind === 'module' ? segment.moduleId : null,
    generated_id: null,
    layer: segment.layer,
    offset_seconds: segment.offsetSeconds,
    duration_seconds: segment.durationSeconds,
  }));
}

describe('the rows a composed manifest would persist', () => {
  const result = composeFor('nervous_ready', 900);
  if (!result.ok) throw new Error('fixture failed to compose');
  const { manifest } = result;
  const rows = segmentRows('11111111-1111-1111-1111-111111111111', manifest.segments);

  it('satisfies the manifest_segments check constraint for every row', () => {
    // The table requires each kind to carry exactly the reference it needs and
    // no other. A row that violated it would abort the whole insert at runtime.
    for (const row of rows) {
      if (row.kind === 'module') {
        expect(row.module_id).not.toBeNull();
        expect(row.generated_id).toBeNull();
      } else if (row.kind === 'silence') {
        expect(row.module_id).toBeNull();
        expect(row.generated_id).toBeNull();
      } else {
        // Generated speech needs a `generated_segments` row first. Nothing
        // produces speech yet, so none should appear.
        throw new Error(`unexpected segment kind: ${row.kind}`);
      }
    }
  });

  it('satisfies the primary key: unique on manifest, layer and ordinal', () => {
    const keys = rows.map((r: any) => `${r.layer}:${r.ordinal}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('satisfies every not-null and positive-duration constraint', () => {
    for (const row of rows) {
      expect(row.ordinal).toBeGreaterThanOrEqual(0);
      expect(row.offset_seconds).toBeGreaterThanOrEqual(0);
      expect(row.duration_seconds).toBeGreaterThan(0);
      expect(['foreground', 'bed']).toContain(row.layer);
    }
  });

  it('produces a manifest row whose budget audit is honest', () => {
    // `dynamic_seconds` must equal the spoken segments, not be asserted.
    const spoken = manifest.segments
      .filter((s) => s.kind === 'generated')
      .reduce((n, s) => n + s.durationSeconds, 0);
    expect(manifest.dynamicSeconds).toBe(spoken);
    expect(manifest.dynamicSeconds).toBe(0); // no provider wired
  });
});

describe('the persistence path itself', () => {
  it('writes a manifest only for a signed-in person', () => {
    // The endpoint is callable by anyone holding the public key, so persisting
    // every anonymous call would let a stranger write unbounded rows.
    const helper = COMPOSER.slice(
      COMPOSER.indexOf('async function persistManifest'),
      COMPOSER.indexOf('Deno.serve')
    );
    expect(helper).toContain('if (!userId) return null;');
  });

  it('persists the manifest and its segments in one transaction', () => {
    // Previously two inserts with a hand-written delete if the second failed.
    // That compensating delete is itself a write that can fail, so a dropped
    // connection between them left an orphan manifest with no segments —
    // which `user_sessions.manifest_id` may already point at. Postgres does
    // the rollback properly now.
    const helper = COMPOSER.slice(
      COMPOSER.indexOf('async function persistManifest'),
      COMPOSER.indexOf('Deno.serve')
    );
    expect(helper).toContain('admin.rpc("persist_session_manifest"');
    expect(helper).not.toContain('.delete()');
  });

  it('never lets a failed write break the session', () => {
    const helper = COMPOSER.slice(
      COMPOSER.indexOf('async function persistManifest'),
      COMPOSER.indexOf('Deno.serve')
    );
    expect(helper).toContain('catch {');
    expect(helper).not.toContain('throw');
  });

  it('links the run to the manifest, completing the join', () => {
    const runs = readFileSync(join(__dirname, '..', 'lib', 'runs.ts'), 'utf8');
    expect(runs).toContain('manifest_id: manifestId');

    const screen = readFileSync(join(__dirname, '..', 'app', 'session.tsx'), 'utf8');
    expect(screen).toContain('composition.manifest?.id ?? null');
    // The run must not be created before the composer has answered, or it
    // records a null manifest id while a manifest was on its way.
    expect(screen).toContain('if (composition.loading) return;');
  });

  it('has somewhere to record cost against that manifest', () => {
    // The far end of the chain. Nothing writes it yet — that needs generation —
    // but the columns and the unique link must exist, or the chain is broken
    // before it starts.
    const cost = readFileSync(
      join(__dirname, '..', '..', 'supabase', 'migrations', '20260908130000_session_cost_telemetry.sql'),
      'utf8'
    );
    for (const column of [
      'manifest_id', 'pricing_version', 'currency',
      'llm_provider', 'llm_input_tokens', 'llm_output_tokens', 'llm_cost_micros',
      'tts_provider', 'tts_characters', 'tts_seconds', 'tts_cost_micros',
      'generated_segments', 'cached_segments', 'library_segments',
      'delivery_bytes', 'delivery_cost_micros', 'total_variable_cost_micros',
    ]) {
      expect(cost).toContain(column);
    }
    expect(cost).toContain('references session_manifests (id) on delete cascade');
    expect(SCHEMA).toContain('create table if not exists session_manifests');
  });
});
