/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  DEFAULT_VOICE,
  VOICE_PROFILES,
  isVoiceProfile,
  labelFor,
  type VoiceProfileId,
} from '../lib/voice-preference';

/**
 * TWO NARRATION VOICES.
 *
 * The property this suite protects: **a voice selects a recording, never a
 * module.** The technique, the wording, the approval, which modules a session
 * contains and how effective they have been are all properties of the
 * intervention. None of them is keyed on the narrator, so changing voice cannot
 * disturb any of them — not by convention, but because nothing joins to the
 * preference except audio resolution.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

const MIGRATION = read('supabase', 'migrations', '20260910100000_voice_profiles_and_renditions.sql');
const COMPOSER = read('supabase', 'functions', 'compose', 'index.ts');
const PREFERENCE = read('src', 'lib', 'voice-preference.ts');
const IMPORTER = read('scripts', 'modules-import.mjs');
const PREPARE = read('scripts', 'prepare-voice-masters.mjs');
const SCREEN = read('src', 'app', 'audio-preferences.tsx');

const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('the product voice profiles, warm by default', () => {
  it('has three since the multilingual pass — warm, clear and bright', () => {
    // `bright` was added as a product profile and is NOT active: it has no
    // provider binding, and a voice offered before it can resolve to audio
    // produces a session somebody cannot hear. See multilingual-readiness.
    expect(VOICE_PROFILES).toHaveLength(3);
    expect(VOICE_PROFILES.map((v) => v.id).sort()).toEqual(['bright', 'clear', 'warm']);
  });

  it('defaults to warm', () => {
    expect(DEFAULT_VOICE).toBe('warm');
  });

  it('the database agrees on the default', () => {
    // Two places could disagree about which voice is the fallback, and the one
    // that matters is the database, because the composer reads it there.
    expect(MIGRATION).toContain("('warm',  'Warm',  true)");
    expect(MIGRATION).toContain("('clear', 'Clear', false)");
  });

  it('allows only one default row', () => {
    // Two defaults would make "the default rendition" ambiguous at exactly the
    // moment a fallback is being resolved.
    expect(MIGRATION).toContain('voice_profiles_single_default');
    expect(MIGRATION).toContain('where is_default');
  });

  it('rejects anything that is not a known profile', () => {
    for (const bad of ['whisper', 'WARM', '', null, undefined, 7, {}]) {
      expect(isVoiceProfile(bad)).toBe(false);
    }
    expect(isVoiceProfile('warm')).toBe(true);
    expect(isVoiceProfile('clear')).toBe(true);
  });

  it('labels are display strings, not identities', () => {
    expect(labelFor('warm')).toBe('Warm');
    expect(labelFor('clear')).toBe('Clear');
    // The id is what travels; the label is what a person reads.
    expect(labelFor('warm')).not.toBe('warm');
  });
});

describe('a voice does not fork the library', () => {
  it('a rendition is module + version + voice, not a second module', () => {
    expect(MIGRATION).toContain('create table if not exists module_renditions');
    expect(MIGRATION).toContain('unique (module_id, version, voice_profile)');
    // The module is referenced, never copied.
    expect(MIGRATION).toContain('references intervention_modules (id)');
  });

  it('the importer writes a rendition rather than duplicating the module', () => {
    expect(IMPORTER).toContain('module_renditions');
    expect(IMPORTER).toContain('voice_profile: voice');
    // One module row per module_key, regardless of how many voices exist.
    expect(IMPORTER).toContain('on_conflict=module_key');
  });

  it('the manifest stays voice-agnostic', () => {
    // The same approved script belongs to both recordings, so the manifest --
    // which carries technique, wording and approval -- must not mention voice.
    const manifest = read('content', 'nervous-ready-tranche-1.draft.json');
    expect(manifest).not.toContain('voice');
    expect(manifest).not.toContain('warm');
    expect(manifest).not.toContain('clear');
  });

  it('effectiveness stays attached to the module', () => {
    // module_effectiveness is keyed on module_id and has no voice column. A
    // voice column here would split a person's history in two the first time
    // they changed voice.
    expect(MIGRATION).not.toContain('module_effectiveness');
    const engine = read('supabase', 'migrations', '20260908120000_session_engine.sql');
    const table = engine.slice(engine.indexOf('create table if not exists module_effectiveness'));
    expect(table.slice(0, 500)).not.toContain('voice');
  });
});

describe('the composer resolves the recording, not the technique', () => {
  it('selects modules on their own merits, then picks a recording', () => {
    // Order matters: modules are queried and filtered on approval first, and
    // the rendition lookup happens afterwards.
    const moduleQuery = COMPOSER.indexOf('from("intervention_modules")');
    const renditionQuery = COMPOSER.indexOf('from("module_renditions")');
    expect(moduleQuery).toBeGreaterThan(-1);
    expect(renditionQuery).toBeGreaterThan(moduleQuery);
  });

  it('plans with the module duration so the same techniques are chosen', () => {
    // If the allocator used each recording's own length, two voices could
    // produce structurally different sessions. The voice must change how a
    // session sounds, never what it contains.
    expect(COMPOSER).toContain("Durations stay the");
    expect(COMPOSER).toContain('storagePath: audioFor.get(row.id)!');
  });

  it('falls back to the default voice per module', () => {
    expect(COMPOSER).toContain('[voice, defaultVoice]');
    expect(COMPOSER).toContain('else if (!audioFor.has(r.module_id))');
  });

  it('requires BOTH approvals', () => {
    // The module's flag says the content is approved; the rendition's says this
    // recording of it is. A bad take of approved wording must not play.
    const renditionBlock = COMPOSER.slice(COMPOSER.indexOf('from("module_renditions")'));
    expect(renditionBlock.slice(0, 400)).toContain('.eq("approved", true)');
    expect(renditionBlock.slice(0, 400)).toContain('.eq("is_active", true)');

    const moduleBlock = COMPOSER.slice(COMPOSER.indexOf('from("intervention_modules")'));
    expect(moduleBlock.slice(0, 400)).toContain('.eq("approved", true)');
  });

  it('drops a module with no playable rendition rather than substituting', () => {
    expect(COMPOSER).toContain('const playable = modules.filter((m) => audioFor.has(m.id));');
    // Existing safe failure, not a silent swap.
    expect(COMPOSER).toContain('if (playable.length === 0) return fail("library_empty");');
  });

  it('a saved preference beats whatever the client claims', () => {
    // A stale client must not override what somebody actually chose.
    expect(COMPOSER).toContain('known(savedVoice) ?? known(requestedVoice) ?? defaultVoice');
  });

  it('an unknown voice resolves rather than failing', () => {
    expect(COMPOSER).toContain('profiles.some((p) => p.id === v) ? v : null');
  });
});

describe('the preference is private and safe to change', () => {
  it('is own-row only', () => {
    for (const policy of [
      'user_preferences_own_select',
      'user_preferences_own_insert',
      'user_preferences_own_update',
    ]) {
      expect(MIGRATION).toContain(policy);
    }
    expect(MIGRATION).toContain('auth.uid() = user_id');
  });

  it('storage paths stay service-role only', () => {
    // Renditions carry storage paths, which are the same class of IP as the
    // recipes. No anon policy, no authenticated policy.
    expect(MIGRATION).toContain('alter table module_renditions enable row level security');
    const after = MIGRATION.slice(MIGRATION.indexOf('module_renditions enable row level security'));
    expect(after.slice(0, 400)).not.toContain('create policy');
  });

  it('the two labels are readable, because they are not secret', () => {
    expect(MIGRATION).toContain('voice_profiles_read');
    expect(MIGRATION).toContain('for select to anon, authenticated');
  });

  it('never throws when the preference cannot be read', () => {
    // A preference that cannot be read must not stop a session starting.
    expect(PREFERENCE).toContain('catch {');
    expect(PREFERENCE).toContain('return DEFAULT_VOICE;');
  });

  it('a signed-out person gets the default and no write', () => {
    expect(PREFERENCE).toContain('if (!userId) return DEFAULT_VOICE;');
    expect(PREFERENCE).toContain('if (!userId) return false;');
  });

  it('the client resolves no audio itself', () => {
    // Which file plays is a server decision, like everything else about
    // selection.
    expect(codeOnly(PREFERENCE)).not.toContain('storage_path');
    expect(codeOnly(PREFERENCE)).not.toContain('module_renditions');
    expect(codeOnly(SCREEN)).not.toContain('storage_path');
  });
});

describe('ingestion supports both voices', () => {
  it('the importer takes a voice', () => {
    expect(IMPORTER).toContain("args.indexOf('--voice')");
    expect(IMPORTER).toContain("? args[voiceIndex + 1] : 'warm'");
  });

  it('files by locale and voice so no two recordings collide', () => {
    // Gained a locale segment in the multilingual pass: the same module in the
    // same voice exists once per language.
    expect(IMPORTER).toContain('modules/${localeId}/${voiceId}/');
  });

  it('the prepare command has a folder per voice', () => {
    expect(PREPARE).toContain("const VOICES = ['warm', 'clear'];");
    expect(PREPARE).toContain("join('content', 'nervous_ready', 'audio-source', voice)");
    expect(PREPARE).toContain("join('content', 'nervous_ready', 'masters', voice)");
  });

  it('rejects an unknown voice', () => {
    expect(PREPARE).toContain('Unknown voice');
  });

  it('does not change the locked audio specification', () => {
    expect(PREPARE).toContain('sampleRate: 44100');
    expect(PREPARE).toContain('channels: 1');
    expect(PREPARE).toContain("bitrate: '96k'");
    expect(PREPARE).toContain('loudness: -16');
    expect(PREPARE).toContain('truePeak: -1');
  });

  it('still refuses a take over its ceiling, in either voice', () => {
    // The ceilings are a property of the recipe, not of the narrator.
    expect(PREPARE).toContain('REJECTED, over by');
    expect(PREPARE).toContain('nr_close_short: 11');
  });
});

describe('the sound layer is untouched by any of this', () => {
  it('the sound layer knows nothing about voice profiles', () => {
    // Checked against code, not prose: both files legitimately use the word
    // "voice" to mean spoken audio, as in "voice-only session". What must be
    // absent is any notion of WHICH narration voice.
    const soundLayer = codeOnly(read('src', 'audio', 'sound-layer.ts'));
    for (const token of ['voiceProfile', 'voice_profile', 'VoiceProfile', 'DEFAULT_VOICE']) {
      expect(soundLayer).not.toContain(token);
    }
  });

  it('the player did not change to accommodate a voice', () => {
    const player = codeOnly(read('src', 'audio', 'use-manifest-player.ts'));
    for (const token of ['voiceProfile', 'voice_profile', 'VoiceProfile']) {
      expect(player).not.toContain(token);
    }
    // It still receives resolved URLs through the same boundary as before.
    expect(player).toContain('CueResolver');
  });
});

describe('type safety', () => {
  it('a voice id is a closed union', () => {
    const ids: VoiceProfileId[] = ['warm', 'clear'];
    expect(ids).toHaveLength(2);
  });
});
