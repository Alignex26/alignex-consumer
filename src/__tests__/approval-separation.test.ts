/// <reference types="node" />

import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * THREE APPROVALS, AND THEY ARE NOT THE SAME APPROVAL.
 *
 *   1. CONTENT VERSION APPROVED   the wording may be spoken by a provider
 *   2. AUDIO RENDITION APPROVED   this recording has been listened to
 *   3. MODULE PLAYABLE            the intervention may enter real sessions
 *
 * Master generation requires (1) and must NOT require (3), because (3) cannot
 * legitimately be true until a master has been generated and approved. A
 * generator that demanded playability would be demanding the output of the step
 * it is itself the input to.
 *
 * They were conflated once, and it cost a production failure. The importer
 * derived the content version's approval from the module's playability flag:
 *
 *     approved_at: row.approved ? row.approved_at : null
 *
 * A module correctly stays unplayable until approved audio exists, so this wrote
 * `approved_at = null` onto wording that WAS approved, and `generate-master`
 * refused it with `content_not_approved`. The gate was right; what it read had
 * been erased upstream.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

const VALIDATOR = join(root, 'scripts', 'modules-validate.mjs');
const IMPORTER = read('scripts', 'modules-import.mjs');
const GENERATOR = read('supabase', 'functions', 'generate-master', 'index.ts');
const COMPOSER = read('supabase', 'functions', 'compose', 'index.ts');
const FINALISE = read('scripts', 'finalise-master.mjs');
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const valid = (over: Record<string, unknown> = {}) => ({
  module_key: 'probe_module',
  family: 'orient',
  technique_key: 'PENDING_CLINICAL',
  storage_path: 'modules/orient/probe_module.m4a',
  duration_seconds: 20,
  intensity: 5,
  script_text: 'A structurally valid stand-in. Not content.',
  requires_headphones: false,
  is_bed: false,
  // The shape this whole suite is about: wording approved, playback not.
  content_approved: true,
  approved: false,
  ...over,
});

function validate(records: unknown[]): { code: number; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'elsea-appr-'));
  const file = join(dir, 'manifest.json');
  writeFileSync(file, JSON.stringify(records));
  try {
    return { code: 0, output: execFileSync(process.execPath, [VALIDATOR, file], { encoding: 'utf8' }) };
  } catch (error) {
    const e = error as { status: number; stdout?: string; stderr?: string };
    return { code: e.status, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('the manifest carries both approvals, separately', () => {
  it('accepts content approved with playback false — the whole point', () => {
    expect(validate([valid()]).code).toBe(0);
  });

  it('requires content_approved to be explicit', () => {
    const r = validate([valid({ content_approved: undefined })]);
    expect(r.code).toBe(1);
    expect(r.output).toContain('not the same as approved');
  });

  it('rejects a non-boolean content_approved', () => {
    expect(validate([valid({ content_approved: 'yes' })]).code).toBe(1);
  });

  it('refuses playable-but-unapproved-wording', () => {
    // Incoherent, and dangerous in this direction specifically: it would put
    // unapproved words in front of somebody.
    const r = validate([valid({ approved: true, content_approved: false })]);
    expect(r.code).toBe(1);
    expect(r.output).toContain('cannot be true while content_approved is false');
  });

  it('allows unapproved wording as long as it is not playable', () => {
    // A draft in the library is fine; a draft somebody can hear is not.
    expect(validate([valid({ content_approved: false, approved: false })]).code).toBe(0);
  });
});

describe('the importer no longer derives one approval from the other', () => {
  it('version approval comes from content_approved', () => {
    expect(IMPORTER).toContain('contentApprovedFor.get(row.module_key)');
  });

  it('the collapsed expression is gone', () => {
    expect(codeOnly(IMPORTER)).not.toContain('row.approved ? row.approved_at : null');
  });

  it('module playability still comes from approved, untouched', () => {
    expect(IMPORTER).toContain('approved: m.approved === true');
  });

  it('the two are read from different fields', () => {
    expect(IMPORTER).toContain('m.content_approved === true');
    expect(IMPORTER).toContain('m.approved === true');
  });
});

describe('generate-master gates on the version, never on playability', () => {
  it('reads the version row for approval', () => {
    expect(GENERATOR).toContain('if (version.approved_at === null) return fail("content_not_approved")');
  });

  it('does NOT require the module to be playable', () => {
    // It selects `approved` on the module row but must not gate on it: that
    // would demand the output of the step this is the input to.
    expect(GENERATOR).not.toContain('if (!module.approved)');
    expect(GENERATOR).not.toContain('module.approved === false');
    expect(GENERATOR).not.toContain('fail("module_not_approved")');
  });

  it('still fails closed on a withdrawn version', () => {
    expect(GENERATOR).toContain('if (version.withdrawn_at !== null) return fail("version_withdrawn")');
  });

  it('still fails closed on a missing script', () => {
    expect(GENERATOR).toContain('if (!script.trim()) return fail("no_approved_script")');
  });

  it('still fails closed on the wrong locale', () => {
    expect(GENERATOR).toContain('if (version.locale !== locale) return fail("locale_mismatch")');
    expect(GENERATOR).toContain('.eq("locale", locale)');
  });
});

describe('nothing became playable because generation is allowed', () => {
  it('the composer still requires module approval', () => {
    const block = COMPOSER.slice(COMPOSER.indexOf('from("intervention_modules")'));
    expect(block.slice(0, 400)).toContain('.eq("approved", true)');
    expect(block.slice(0, 400)).toContain('.eq("is_active", true)');
  });

  it('the composer still requires an approved rendition', () => {
    const block = COMPOSER.slice(COMPOSER.indexOf('from("module_renditions")'));
    expect(block.slice(0, 400)).toContain('.eq("approved", true)');
  });

  it('a module with no playable rendition is dropped, not substituted', () => {
    expect(COMPOSER).toContain('const playable = modules.filter((m) => audioFor.has(m.id));');
  });

  it('the composer knows nothing about content_approved', () => {
    // Playability is its question; wording approval is not.
    expect(codeOnly(COMPOSER)).not.toContain('content_approved');
  });

  it('the manifest keeps every module unplayable', () => {
    const manifest = JSON.parse(read('content', 'nervous-ready-tranche-1.draft.json')) as {
      module_key: string; approved: boolean; content_approved: boolean;
    }[];
    expect(manifest).toHaveLength(5);
    for (const row of manifest) {
      expect(row.content_approved).toBe(true);
      expect(row.approved).toBe(false);
    }
  });
});

describe('synthesis still approves nothing', () => {
  it('generate-master writes no rendition', () => {
    expect(GENERATOR).toContain('rendition_written: false');
  });

  it('finalise writes the rendition unapproved', () => {
    expect(FINALISE).toContain('approved: false');
    expect(FINALISE).toContain('approved_at: null');
  });

  it('no step sets module playability automatically', () => {
    for (const source of [GENERATOR, FINALISE]) {
      expect(codeOnly(source)).not.toContain('approved: true');
    }
  });
});
