import { getSupabase } from '@/lib/supabase';

/**
 * Which of the two narration voices a person hears.
 *
 * V1 supports exactly two. `warm` and `clear` are internal product labels — not
 * descriptions of a person, and not gender classifications. The display label
 * is the only thing anyone sees.
 *
 * WHAT THIS DOES NOT TOUCH. A voice preference selects a *recording*, never a
 * module. The technique, the wording, the approval, which modules a session
 * contains and how effective they have been for someone are all properties of
 * the intervention, and none of them is keyed on the narrator. Changing voice
 * therefore cannot disturb session history, module identity, effectiveness data
 * or recipe selection — not by convention, but because nothing joins to it
 * except audio resolution.
 *
 * The client holds the person's choice and passes it along. It does not resolve
 * audio: which file plays is decided by the composer, server-side, along with
 * everything else about selection.
 */

export const VOICE_PROFILES = [
  { id: 'warm', label: 'Warm' },
  { id: 'clear', label: 'Clear' },
  { id: 'bright', label: 'Bright' },
] as const;

/**
 * Languages the product knows about.
 *
 * `contentReady` is the only thing that decides whether a language can be
 * offered: it means a COMPLETE approved library exists in it. The planned
 * locales are recorded so the model is exercised, and are all false — no
 * translated content exists.
 *
 * ELSEA is MULTILINGUAL-READY, not multilingual. A schema that can represent a
 * language is not a language the product supports.
 */
export const LOCALES = [
  { id: 'en', label: 'English', contentReady: true },
  { id: 'es', label: 'Español', contentReady: false },
  { id: 'de', label: 'Deutsch', contentReady: false },
  { id: 'fr', label: 'Français', contentReady: false },
  { id: 'pt-BR', label: 'Português (Brasil)', contentReady: false },
] as const;

export type LocaleId = (typeof LOCALES)[number]['id'];

export const DEFAULT_LOCALE: LocaleId = 'en';

/** Only a content-ready language may be offered or composed from. */
export function selectableLocales() {
  return LOCALES.filter((l) => l.contentReady);
}

export function isLocale(value: unknown): value is LocaleId {
  return LOCALES.some((l) => l.id === value);
}

export function isSelectableLocale(value: unknown): boolean {
  return selectableLocales().some((l) => l.id === value);
}

export type VoiceProfileId = (typeof VOICE_PROFILES)[number]['id'];

/** Used when nobody has chosen, and the target of every fallback. */
export const DEFAULT_VOICE: VoiceProfileId = 'warm';

export function isVoiceProfile(value: unknown): value is VoiceProfileId {
  return VOICE_PROFILES.some((v) => v.id === value);
}

export function labelFor(id: VoiceProfileId): string {
  return VOICE_PROFILES.find((v) => v.id === id)?.label ?? id;
}

/**
 * Reads the saved preference.
 *
 * Returns the default for anyone signed out, for anyone who has never chosen,
 * and for any value this build does not recognise. A voice that has been
 * retired since somebody chose it is not an error — it is a reason to use the
 * default.
 *
 * Never throws. A preference that cannot be read must not stop a session
 * starting; it just means the default voice plays.
 */
export type Preferences = { voice: VoiceProfileId; locale: LocaleId };

export const DEFAULT_PREFERENCES: Preferences = {
  voice: DEFAULT_VOICE,
  locale: DEFAULT_LOCALE,
};

/**
 * Reads both saved preferences.
 *
 * A language that is not content-ready resolves to the default rather than
 * being honoured — but note that the SERVER is authoritative about this. The
 * composer refuses an unavailable locale outright rather than substituting one,
 * so a stale client cannot force a mixed-language session by claiming a
 * language it should not have.
 */
export async function loadPreferences(userId: string | null): Promise<Preferences> {
  if (!userId) return DEFAULT_PREFERENCES;

  const supabase = getSupabase();
  if (!supabase) return DEFAULT_PREFERENCES;

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('voice_profile, locale')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return DEFAULT_PREFERENCES;

    const row = data as { voice_profile?: unknown; locale?: unknown };
    return {
      voice: isVoiceProfile(row.voice_profile) ? row.voice_profile : DEFAULT_VOICE,
      locale: isSelectableLocale(row.locale) ? (row.locale as LocaleId) : DEFAULT_LOCALE,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function loadVoicePreference(userId: string | null): Promise<VoiceProfileId> {
  if (!userId) return DEFAULT_VOICE;

  const supabase = getSupabase();
  if (!supabase) return DEFAULT_VOICE;

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('voice_profile')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return DEFAULT_VOICE;

    const value = (data as { voice_profile?: unknown }).voice_profile;
    return isVoiceProfile(value) ? value : DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

/**
 * Saves the preference.
 *
 * Returns whether it was stored. A signed-out person can still choose a voice
 * for the session in front of them — it simply is not remembered, because there
 * is nowhere to remember it that belongs to them.
 */
export async function saveVoicePreference(
  userId: string | null,
  voice: VoiceProfileId
): Promise<boolean> {
  if (!userId) return false;

  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, voice_profile: voice, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    return !error;
  } catch {
    return false;
  }
}
