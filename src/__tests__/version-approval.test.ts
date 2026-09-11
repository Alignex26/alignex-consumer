/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * RECORDING AN APPROVAL IS NOT MUTATING CONTENT.
 *
 * `intervention_module_versions` is append-only, and must stay so: a version
 * whose wording can be edited in place is not a version, and approval would
 * mean nothing if the approved text could change afterwards.
 *
 * But that guard also made it impossible to record that content HAD been
 * approved. The five English rows were imported before content approval was
 * separated from module playability, so they carry `approved_at = null`, and a
 * second import reported "0 new; 5 already present" while changing nothing.
 *
 * Two things caused that, and both had to be fixed:
 *
 *   1. `resolution=ignore-duplicates` SKIPPED the existing rows entirely.
 *   2. The trigger would have rejected the UPDATE even so.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

const IMPORTER = read('scripts', 'modules-import.mjs');
const TRIGGER = read('supabase', 'migrations', '20260911100000_permit_content_approval.sql');
const ORIGINAL = read('supabase', 'migrations', '20260909160000_novelty_and_saved_sessions.sql');
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('the importer updates an existing version row', () => {
  it('merges rather than ignoring', () => {
    expect(IMPORTER).toContain('resolution=merge-duplicates');
    expect(codeOnly(IMPORTER)).not.toContain('resolution=ignore-duplicates');
  });

  it('keys on the identity that must not duplicate', () => {
    // Same conflict target as before, so a second import updates the same row
    // rather than creating a second one.
    expect(IMPORTER).toContain('on_conflict=module_id,locale,version');
  });

  it('reports approvals rather than only counting new rows', () => {
    // "Recorded 0 new version row(s)" was true and useless: it looked like
    // success while nothing had been updated.
    expect(IMPORTER).toContain('carry content approval');
    expect(codeOnly(IMPORTER)).not.toContain('already present');
  });

  it('sends the approval from content_approved, not from playability', () => {
    expect(IMPORTER).toContain('contentApprovedFor.get(row.module_key)');
  });
});

describe('the trigger permits approval and nothing more', () => {
  it('still refuses ordinary updates', () => {
    expect(TRIGGER).toContain('is append-only; publish a new version');
  });

  it('permits approval only from null', () => {
    expect(TRIGGER).toContain('old.approved_at is null');
    expect(TRIGGER).toContain('new.approved_at is not null');
  });

  it('refuses to approve a withdrawn version', () => {
    // A withdrawn version must not be revivable by approving it.
    const block = TRIGGER.slice(TRIGGER.indexOf('Content approval'));
    expect(block).toContain('old.withdrawn_at is null');
    expect(block).toContain('new.withdrawn_at is null');
  });

  it('keeps withdrawal as its own one-way exception', () => {
    expect(TRIGGER).toContain('if old.withdrawn_at is null and new.withdrawn_at is not null then');
  });

  it('requires every substantive field to be unchanged', () => {
    for (const field of ['module_id', 'version', 'storage_path', 'duration_seconds', 'technique_key']) {
      expect(TRIGGER).toContain(`new.${field}`);
      expect(TRIGGER).toContain(`old.${field}`);
    }
  });

  it('now guards locale and script_text, which it never did', () => {
    // Added after the original trigger was written, so they were not being
    // compared at all -- a withdrawal could have carried a different script
    // with it. This tightens the guard rather than loosening it.
    expect(TRIGGER).toContain('new.script_text');
    expect(TRIGGER).toContain('new.locale');
    expect(ORIGINAL).not.toContain('new.script_text');
  });
});

describe('approving content changes nothing else', () => {
  it('does not touch module playability', () => {
    expect(codeOnly(TRIGGER)).not.toContain('intervention_modules');
    expect(IMPORTER).toContain('approved: m.approved === true');
  });

  it('does not create or approve a rendition', () => {
    expect(codeOnly(TRIGGER)).not.toContain('module_renditions');
    // An import cannot approve a recording; only somebody listening can.
    expect(IMPORTER).toContain('approved: false,');
  });

  it('writes no audio', () => {
    // storage_path appears in the immutability check, which is the opposite of
    // writing: the trigger requires it to be UNCHANGED. What must be absent is
    // any insert or update of audio.
    const code = codeOnly(TRIGGER);
    expect(code).toContain('new.storage_path');
    expect(code.toLowerCase()).not.toContain('insert into');
    expect(code.toLowerCase()).not.toContain('intervention-audio');
  });

  it('the manifest still keeps every module unplayable', () => {
    const manifest = JSON.parse(read('content', 'nervous-ready-tranche-1.draft.json')) as {
      approved: boolean; content_approved: boolean; script_text: string;
    }[];
    expect(manifest).toHaveLength(5);
    for (const row of manifest) {
      expect(row.approved).toBe(false);
      expect(row.content_approved).toBe(true);
      expect(row.script_text.length).toBeGreaterThan(0);
    }
  });

  it('the scripts are unchanged by any of this', () => {
    const manifest = JSON.parse(read('content', 'nervous-ready-tranche-1.draft.json')) as {
      module_key: string; script_text: string;
    }[];
    const lengths = Object.fromEntries(manifest.map((m) => [m.module_key, m.script_text.length]));
    // The counts verified by SHA-256 against the approved pack before the first
    // import. If any of these moved, wording changed.
    expect(lengths).toEqual({
      nr_arrive_short: 190,
      nr_regulate_short: 248,
      nr_reframe_short: 335,
      nr_prepare_short: 381,
      nr_close_short: 99,
    });
  });
});
