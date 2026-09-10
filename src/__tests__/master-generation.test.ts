/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * OPERATOR-ONLY MASTER GENERATION.
 *
 * A reusable intervention master is produced once and heard by everyone. The
 * properties that matter are therefore about what CANNOT happen:
 *
 *   - arbitrary text cannot be spoken
 *   - unapproved or withdrawn content cannot be spoken
 *   - a language cannot be substituted
 *   - an unmapped voice cannot be silently replaced
 *   - a successful render cannot become playable audio on its own
 *
 * None of these is a runtime check somebody remembered to write. Each is a
 * shape: there is no parameter, no fallback list, no code path.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const GENERATOR = read('supabase', 'functions', 'generate-master', 'index.ts');
const FINALISE = read('scripts', 'finalise-master.mjs');
const SCRIPT_MIGRATION = read('supabase', 'migrations', '20260910170000_approved_script_text.sql');
const ADAPTER = read('supabase', 'functions', '_shared', 'elevenlabs.ts');

describe('arbitrary text cannot reach the provider', () => {
  it('the request carries identifiers, never speech', () => {
    // There is no `text` parameter and nowhere to put one.
    const body = GENERATOR.slice(GENERATOR.indexOf('let body:'), GENERATOR.indexOf('try {'));
    expect(body).toContain('module_key');
    expect(body).toContain('locale');
    expect(body).toContain('voice_profile');
    expect(body).not.toContain('text');
    expect(body).not.toContain('script');
  });

  it('the spoken text is fetched from the database', () => {
    expect(GENERATOR).toContain('.select("script_text")');
    expect(GENERATOR).toContain('text: script,');
  });

  it('refuses a version with no stored script', () => {
    expect(GENERATOR).toContain('if (!script.trim()) return fail("no_approved_script")');
  });

  it('the approved wording now has somewhere to live', () => {
    // It previously existed only in a markdown pack, which is survivable while a
    // person reads from it and not survivable once a server generates the audio.
    expect(SCRIPT_MIGRATION).toContain('add column if not exists script_text text');
    expect(SCRIPT_MIGRATION).toContain('intervention_module_versions');
  });

  it('the script column is nullable rather than backfilled with invention', () => {
    expect(SCRIPT_MIGRATION).toContain('Deliberately nullable');
  });
});

describe('only approved, current, matching content is synthesised', () => {
  const gate = (needle: string) => expect(GENERATOR).toContain(needle);

  it('rejects an unknown module', () => gate('return fail("unknown_module")'));
  it('rejects an inactive module', () => gate('return fail("module_inactive")'));
  it('rejects an unknown version', () => gate('return fail("unknown_version")'));
  it('rejects a withdrawn version', () => gate('return fail("version_withdrawn")'));
  it('rejects unapproved content', () => gate('return fail("content_not_approved")'));
  it('rejects a locale mismatch', () => gate('return fail("locale_mismatch")'));

  it('checks approval before it reaches the provider', () => {
    const approvalAt = GENERATOR.indexOf('content_not_approved');
    const synthesiseAt = GENERATOR.indexOf('provider.synthesise');
    expect(approvalAt).toBeGreaterThan(-1);
    expect(synthesiseAt).toBeGreaterThan(approvalAt);
  });

  it('the finalise step checks approval independently', () => {
    // Two gates, because the render and the publish are separate actions and
    // content could be withdrawn between them.
    expect(FINALISE).toContain('is withdrawn');
    expect(FINALISE).toContain('is not approved content');
  });
});

describe('the provider voice is resolved server-side', () => {
  it('the operator names an ELSEA profile, never a provider voice', () => {
    expect(GENERATOR).toContain('.from("provider_voice_mappings")');
    expect(GENERATOR).toContain('.eq("voice_profile", voiceProfile)');
    // No provider voice id is accepted from the caller.
    const body = GENERATOR.slice(GENERATOR.indexOf('let body:'), GENERATOR.indexOf('try {'));
    expect(body).not.toContain('provider_voice_id');
  });

  it('the mapping is matched on locale as well as profile', () => {
    const block = GENERATOR.slice(GENERATOR.indexOf('provider_voice_mappings'));
    expect(block.slice(0, 400)).toContain('.eq("locale", locale)');
  });

  it('an unmapped voice FAILS rather than resolving to another', () => {
    expect(GENERATOR).toContain('if (!mapping) return fail("no_provider_mapping")');
    // No fallback voice list exists here at all.
    expect(GENERATOR).not.toContain('defaultVoice');
  });

  it('an inactive profile is refused', () => {
    expect(GENERATOR).toContain('return fail("voice_profile_unavailable")');
  });

  it('the operator command needs no provider voice id', () => {
    expect(FINALISE).toContain("pick('--voice')");
    expect(codeOnly(FINALISE)).not.toContain('provider_voice_id');
  });
});

describe('no cross-language anything', () => {
  it('an unknown or not-ready locale is refused', () => {
    expect(GENERATOR).toContain('return fail("unknown_locale")');
    expect(GENERATOR).toContain('return fail("locale_not_content_ready")');
  });

  it('the version must match the requested locale', () => {
    expect(GENERATOR).toContain('.eq("locale", locale)');
    expect(GENERATOR).toContain('if (version.locale !== locale) return fail("locale_mismatch")');
  });

  it('the staging path carries the locale, so nothing collides', () => {
    expect(GENERATOR).toContain('`staging/${locale}/${voiceProfile}/');
  });

  it('there is no fallback locale anywhere', () => {
    const code = codeOnly(GENERATOR);
    expect(code).not.toContain('defaultLocale');
    expect(code).not.toContain("'en'");
  });
});

describe('master generation is not session TTS', () => {
  it('writes no generated_segments row', () => {
    // That table is the per-session speech cache keyed on structured state. A
    // master belongs to everybody and to no session.
    expect(codeOnly(GENERATOR)).not.toContain('generated_segments');
  });

  it('attaches to no user and no session', () => {
    const code = codeOnly(GENERATOR);
    expect(code).not.toContain('user_id');
    expect(code).not.toContain('session_id');
    expect(code).not.toContain('manifest_id');
  });

  it('does not consume the per-session dynamic budget', () => {
    // The 30s/45s budget governs speech generated DURING a session. Charging a
    // one-off production render against it would be meaningless.
    const code = codeOnly(GENERATOR);
    expect(code).not.toContain('checkBudget');
    expect(code).not.toContain('BUDGET_CEILING_SECONDS');
    expect(code).not.toContain('DynamicBudget');
  });

  it('the dynamic path is untouched', () => {
    const speech = read('supabase', 'functions', '_shared', 'speech.ts');
    expect(speech).toContain('BUDGET_NORMAL_SECONDS = 30');
    expect(speech).toContain('BUDGET_CEILING_SECONDS = 45');
    expect(speech).not.toContain('generate-master');
  });
});

describe('synthesis is not approval', () => {
  it('the function writes no rendition at all', () => {
    expect(GENERATOR).toContain('rendition_written: false');
    expect(codeOnly(GENERATOR)).not.toContain('module_renditions');
  });

  it('the finalise step writes the rendition unapproved', () => {
    expect(FINALISE).toContain('approved: false');
    expect(FINALISE).toContain('approved_at: null');
  });

  it('says out loud that it will not play', () => {
    expect(FINALISE).toContain('IT WILL NOT PLAY UNTIL SOMEBODY APPROVES IT');
  });

  it('raw output goes to staging, nowhere the composer signs', () => {
    expect(GENERATOR).toContain('staging/');
    expect(GENERATOR).not.toContain('`modules/');
  });
});

describe('the operator path is hard to misuse', () => {
  it('is service-role only', () => {
    expect(GENERATOR).toContain('auth !== `Bearer ${SERVICE_ROLE_KEY}`');
    expect(GENERATOR).toContain('"forbidden"');
  });

  it('does one module, one locale, one voice', () => {
    expect(FINALISE).toContain('All three are required and singular');
    // No loop over modules or voices.
    expect(codeOnly(FINALISE)).not.toMatch(/for\s*\(\s*const\s+\w+\s+of\s+(MODULES|VOICES|LOCALES)/);
  });

  it('is dry run by default', () => {
    expect(FINALISE).toContain("const commit = args.includes('--commit')");
    expect(FINALISE).toContain('Dry run. Nothing uploaded, no rendition written.');
  });

  it('rejects a master that misses the specification', () => {
    for (const gate of ['over ceiling by', 'expected mono', 'loudness could not be measured']) {
      expect(FINALISE).toContain(gate);
    }
    expect(FINALISE).toContain('re-generated, not compressed to fit');
  });

  it('needs no ElevenLabs key locally', () => {
    // The whole reason for the split: that key stays in Supabase.
    expect(codeOnly(FINALISE)).not.toContain('ELEVENLABS_API_KEY');
    expect(FINALISE).toContain('that one stays in Supabase');
  });
});

describe('secrets stay where they belong', () => {
  it('no secret is returned by the function', () => {
    const response = GENERATOR.slice(GENERATOR.lastIndexOf('return json({'));
    expect(response).not.toContain('provider_voice_id');
    expect(response).not.toContain('ELEVENLABS_API_KEY');
    expect(response).not.toContain('SERVICE_ROLE_KEY');
  });

  it('a provider error is mapped, not echoed', () => {
    expect(GENERATOR).toContain('error instanceof SynthesisError ? error.failure');
    expect(ADAPTER).not.toContain('await response.text()');
  });

  it('nothing about this reaches client code', () => {
    const composition = read('src', 'lib', 'composition.ts');
    expect(composition).not.toContain('generate-master');
    expect(composition.toLowerCase()).not.toContain('elevenlabs');
  });
});
