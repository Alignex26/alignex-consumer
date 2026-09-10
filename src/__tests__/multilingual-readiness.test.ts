/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  DEFAULT_LOCALE,
  DEFAULT_VOICE,
  LOCALES,
  VOICE_PROFILES,
  isLocale,
  isSelectableLocale,
  isVoiceProfile,
  selectableLocales,
} from '../lib/voice-preference';

/**
 * MULTILINGUAL-READY, NOT MULTILINGUAL.
 *
 * The model can hold more than one language. No translated content exists, and
 * nothing here should be read as saying the product supports one.
 *
 * The rule this suite exists to protect above all others:
 *
 *   VOICE falls back. LANGUAGE NEVER DOES.
 *
 * A missing rendition in the requested voice may resolve to the default voice
 * within the same language. A missing language resolves to nothing — because a
 * session that is half Spanish and half English is a worse failure than no
 * session, and one nobody would report as a bug.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const MIGRATION = read('supabase', 'migrations', '20260910140000_locales_and_provider_voices.sql');
const BRIGHT = read('supabase', 'migrations', '20260910150000_bright_inactive_until_mapped.sql');
const COMPOSER = read('supabase', 'functions', 'compose', 'index.ts');
const PREFERENCE = read('src', 'lib', 'voice-preference.ts');
const IMPORTER = read('scripts', 'modules-import.mjs');
const NOVELTY = read('supabase', 'functions', '_shared', 'novelty.ts');
const REPLAY = read('supabase', 'functions', '_shared', 'replay.ts');

describe('three product voice profiles', () => {
  it('warm remains valid', () => {
    expect(isVoiceProfile('warm')).toBe(true);
    expect(DEFAULT_VOICE).toBe('warm');
    expect(MIGRATION).not.toContain("update voice_profiles set is_active = false where id = 'warm'");
  });

  it('clear remains valid', () => {
    expect(isVoiceProfile('clear')).toBe(true);
  });

  it('bright exists as a product profile', () => {
    expect(isVoiceProfile('bright')).toBe(true);
    expect(VOICE_PROFILES).toHaveLength(3);
    expect(MIGRATION).toContain("('bright', 'Bright', false)");
  });

  it('bright is NOT active until it is mapped', () => {
    // A voice offered before it can resolve to audio produces a session
    // somebody cannot hear.
    expect(BRIGHT).toContain("set is_active = false");
    expect(BRIGHT).toContain("where id = 'bright'");
  });

  it('activating bright is a data action, not another migration', () => {
    expect(BRIGHT).toContain('DATA ACTION, NOT A MIGRATION');
  });

  it('no provider voice id was invented for bright', () => {
    // Casting is not an engineering decision. The mapping table is empty.
    const code = codeOnly(MIGRATION) + codeOnly(BRIGHT);
    expect(code).not.toMatch(/insert into provider_voice_mappings/i);
  });
});

describe('the language model', () => {
  it('English is the default and the only content-ready language', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(selectableLocales().map((l) => l.id)).toEqual(['en']);
  });

  it('the four planned languages exist and are not content-ready', () => {
    for (const id of ['es', 'de', 'fr', 'pt-BR']) {
      expect(isLocale(id)).toBe(true);
      // Known to the model, and not offerable.
      expect(isSelectableLocale(id)).toBe(false);
    }
  });

  it('uses standards-based identifiers, not display strings', () => {
    for (const locale of LOCALES) {
      expect(locale.id).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
      // The label is not the key: pt-BR is keyed on the tag, not on the name.
      expect(locale.id).not.toBe(locale.label);
    }
    expect(MIGRATION).toContain("check (id ~ '^[a-z]{2}(-[A-Z]{2})?$')");
  });

  it('separates intent from readiness', () => {
    // is_enabled says the product means to offer it; is_content_ready says a
    // complete approved library exists. Conflating them is how a language gets
    // offered before it can be delivered.
    expect(MIGRATION).toContain('is_enabled');
    expect(MIGRATION).toContain('is_content_ready');
    expect(MIGRATION).toContain("('es',    'Español',              false, false)");
  });

  it('no planned language is marked content-ready anywhere', () => {
    for (const locale of LOCALES.filter((l) => l.id !== 'en')) {
      expect(locale.contentReady).toBe(false);
    }
  });
});

describe('LANGUAGE NEVER FALLS BACK', () => {
  it('an unavailable language fails with its own distinct reason', () => {
    // Not library_empty. The caller learns the language is unavailable, not
    // that ELSEA is broken.
    expect(COMPOSER).toContain('return fail("locale_unavailable")');
  });

  it('only a content-ready locale can be composed from', () => {
    expect(COMPOSER).toContain('.eq("is_content_ready", true)');
    expect(COMPOSER).toContain('const localeReady = readyLocales.some((l) => l.id === asked)');
  });

  it('renditions are filtered by locale in the query', () => {
    // This is the line that makes cross-language fallback impossible rather
    // than merely discouraged.
    const block = COMPOSER.slice(COMPOSER.indexOf('from("module_renditions")'));
    expect(block.slice(0, 600)).toContain('.eq("locale", locale)');
  });

  it('and filtered AGAIN in memory, so a query refactor cannot break it', () => {
    expect(COMPOSER).toContain('.filter((r) => r.locale === locale)');
  });

  it('the voice fallback list contains no locale', () => {
    // Voice falls back across voices only. There is no equivalent list of
    // languages to fall back through, by construction.
    expect(COMPOSER).toContain('.in("voice_profile", [voice, defaultVoice])');
    expect(COMPOSER).not.toContain('[locale, defaultLocale]');
    expect(COMPOSER).not.toContain('"en"].includes');
  });

  it('no mixed-language manifest is possible', () => {
    // One locale is resolved before any rendition is read, and every rendition
    // considered is filtered to it. There is no path that assembles segments
    // from two.
    const resolveAt = COMPOSER.indexOf('const locale = asked;');
    const renditionAt = COMPOSER.indexOf('from("module_renditions")');
    expect(resolveAt).toBeGreaterThan(-1);
    expect(renditionAt).toBeGreaterThan(resolveAt);
  });

  it('nothing translates as a workaround', () => {
    const code = codeOnly(COMPOSER);
    for (const forbidden of ['translate', 'translation', 'i18n.t(']) {
      expect(code.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe('VOICE falls back, within one language', () => {
  it('resolves the requested voice first, then the default', () => {
    expect(COMPOSER).toContain('if (r.voice_profile === voice) audioFor.set(r.module_id, r.storage_path)');
    expect(COMPOSER).toContain('else if (!audioFor.has(r.module_id))');
  });

  it('the fallback candidates were already narrowed to one locale', () => {
    // The locale filter appears before the voice fallback runs, so the
    // fallback cannot reach across a language even by accident.
    const localeFilter = COMPOSER.indexOf('.eq("locale", locale)');
    const voiceFallback = COMPOSER.indexOf('else if (!audioFor.has(r.module_id))');
    expect(localeFilter).toBeGreaterThan(-1);
    expect(voiceFallback).toBeGreaterThan(localeFilter);
  });
});

describe('identity does not fork', () => {
  it('a module does not fork by language', () => {
    // The localised script is a version of the same module, not a new module.
    expect(MIGRATION).toContain('alter table intervention_module_versions');
    expect(MIGRATION).toContain('unique (module_id, locale, version)');
    expect(codeOnly(MIGRATION)).not.toContain('create table if not exists localised_modules');
  });

  it('a module does not fork by voice', () => {
    expect(MIGRATION).toContain('unique (module_id, locale, version, voice_profile)');
  });

  it('effectiveness is not split by voice or language', () => {
    // Splitting it would fragment a person's history the first time they
    // changed either.
    const code = codeOnly(MIGRATION);
    expect(code).not.toContain('module_effectiveness');
  });

  it('no competing version system was created', () => {
    // intervention_module_versions already was the content artifact; it lacked
    // a language, not a replacement.
    const code = codeOnly(MIGRATION);
    expect(code).not.toContain('create table if not exists module_translations');
    expect(code).not.toContain('create table if not exists localised_content');
  });
});

describe('provider details stay server-side', () => {
  it('provider mappings have no read policy at all', () => {
    expect(MIGRATION).toContain('alter table provider_voice_mappings enable row level security');
    const after = MIGRATION.slice(MIGRATION.indexOf('provider_voice_mappings enable row level security'));
    expect(after.slice(0, 300)).not.toContain('create policy');
  });

  it('a provider voice id never reaches user preferences', () => {
    expect(codeOnly(PREFERENCE)).not.toContain('provider_voice_id');
    expect(codeOnly(PREFERENCE)).not.toContain('elevenlabs');
    // The saved preference is an ELSEA profile.
    expect(PREFERENCE).toContain("voice_profile: voice");
  });

  it('the client never sees a provider name or voice id', () => {
    const view = MIGRATION.slice(MIGRATION.indexOf('create or replace view available_voices'));
    const body = view.slice(0, 700);
    expect(body).toContain('voice_label');
    expect(body).not.toContain('provider_voice_id');
    expect(body).not.toMatch(/select[\s\S]*m\.provider\b/);
  });

  it('the user preference column holds a profile, not a provider', () => {
    expect(MIGRATION).toContain('references locales (id)');
    expect(codeOnly(MIGRATION)).not.toContain('user_preferences.*provider');
  });
});

describe('replay and fingerprints stay honest', () => {
  it('a fingerprint carries module identity and version, not a voice', () => {
    // A different narrator reading the same approved words is the same
    // composition. Putting the voice in would make every voice change look
    // like a new session.
    expect(NOVELTY).toContain('moduleId}@${versions.get');
    expect(codeOnly(NOVELTY)).not.toContain('voice');
    expect(codeOnly(NOVELTY)).not.toContain('provider');
  });

  it('signed URLs are excluded from fingerprints', () => {
    expect(NOVELTY).toContain('SIGNED URLS');
  });

  it('exact replay rebuilds from saved version identities', () => {
    expect(REPLAY).toContain('moduleVersionIds');
    expect(REPLAY).toContain('rebuildExact');
  });

  it('replay is still deliberately unreachable', () => {
    // Nothing saves a session, so nothing replays one. The model is being made
    // safe for it, not activated.
    const composer = codeOnly(COMPOSER);
    expect(composer).not.toContain('rebuildExact');
    expect(composer).not.toContain('saved_sessions');
  });
});

describe('ingestion knows about languages', () => {
  it('takes a locale and rejects an unsupported one', () => {
    expect(IMPORTER).toContain("const LOCALES = ['en', 'es', 'de', 'fr', 'pt-BR']");
    expect(IMPORTER).toContain('Unsupported locale');
  });

  it('rejects an unknown voice', () => {
    expect(IMPORTER).toContain("const VOICES = ['warm', 'clear', 'bright']");
    expect(IMPORTER).toContain('Unknown voice');
  });

  it('files audio by locale and voice, so nothing collides', () => {
    expect(IMPORTER).toContain('modules/${localeId}/${voiceId}/');
  });

  it('rendition identity includes the locale', () => {
    expect(IMPORTER).toContain('on_conflict=module_id,locale,version,voice_profile');
  });

  it('version identity includes the locale', () => {
    expect(IMPORTER).toContain('on_conflict=module_id,locale,version');
  });

  it('is still dry run by default', () => {
    expect(IMPORTER).toContain("const commit = args.includes('--commit')");
    expect(IMPORTER).toContain('Dry run. Nothing written, nothing uploaded.');
  });

  it('English content keys and ceilings are unchanged', () => {
    const manifest = read('content', 'nervous-ready-tranche-1.draft.json');
    for (const key of [
      'nr_arrive_short', 'nr_regulate_short', 'nr_reframe_short',
      'nr_prepare_short', 'nr_close_short',
    ]) {
      expect(manifest).toContain(key);
    }
    // No locale was pushed into the manifest: it describes the module, and the
    // language is a property of the import.
    expect(manifest).not.toContain('locale');
  });
});

describe('nothing about TTS safety changed', () => {
  it('raw user text still cannot reach a provider', () => {
    const provider = read('supabase', 'functions', '_shared', 'provider.ts');
    for (const forbidden of ['situationText', 'freeText', 'userText', 'transcript']) {
      expect(provider).not.toContain(forbidden);
    }
  });

  it('the budget is unchanged', () => {
    const speech = read('supabase', 'functions', '_shared', 'speech.ts');
    expect(speech).toContain('BUDGET_NORMAL_SECONDS = 30');
    expect(speech).toContain('BUDGET_CEILING_SECONDS = 45');
  });

  it('no provider was called in this pass', () => {
    // The adapter is untouched by the multilingual work.
    const adapter = read('supabase', 'functions', '_shared', 'elevenlabs.ts');
    expect(adapter).not.toContain('locale');
  });
});
