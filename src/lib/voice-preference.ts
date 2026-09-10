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
] as const;

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
