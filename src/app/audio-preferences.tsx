import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { YouCopy } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import {
  DEFAULT_VOICE,
  loadVoicePreference,
  saveVoicePreference,
  VOICE_PROFILES,
  type VoiceProfileId,
} from '@/lib/voice-preference';
import { useAuth } from '@/state/auth';

const C = ElseaS02Color;

/**
 * SCREEN 20 — AUDIO PREFERENCES.
 *
 * This screen was built as a routed shell with a note saying the controls
 * belonged here once the session model gained something controllable. It has:
 * the narration voice.
 *
 * FUNCTIONAL ONLY. This is the minimum that lets someone choose and have the
 * choice stick. It is not a design pass, and the styling deliberately follows
 * the existing screen rather than introducing anything new.
 *
 * A voice selects a RECORDING, never a module. Changing it cannot affect
 * session history, module identity, effectiveness or which techniques a session
 * contains — the composer picks modules first, on their own merits, and only
 * then decides which recording of each to play.
 */
export default function AudioPreferencesScreen() {
  const { userId } = useAuth();
  const [voice, setVoice] = useState<VoiceProfileId>(DEFAULT_VOICE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void loadVoicePreference(userId).then((saved) => {
      if (cancelled) return;
      setVoice(saved);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const choose = useCallback(
    (next: VoiceProfileId) => {
      // Shown immediately, saved behind it. A write that fails leaves the
      // choice applying to this session and unremembered, which is the correct
      // outcome for someone signed out and an acceptable one for a dropped
      // connection.
      setVoice(next);
      void saveVoicePreference(userId, next);
    },
    [userId]
  );

  return (
    <ElseaScreen screen="audio_preferences" onBack={goBack} heading={YouCopy.audioHeading}>
      <Text style={styles.body} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
        Which voice reads your sessions.
      </Text>

      <View style={styles.options}>
        {VOICE_PROFILES.map((profile) => {
          const selected = voice === profile.id;
          return (
            <Pressable
              key={profile.id}
              onPress={() => choose(profile.id)}
              disabled={loading}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: loading }}
              accessibilityHint={`Reads your sessions in the ${profile.label} voice.`}
              style={[styles.option, selected && styles.optionSelected]}>
              <Text
                style={[styles.optionLabel, selected && styles.optionLabelSelected]}
                maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
                {profile.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
        {userId
          ? 'Saved. You can change this whenever you like.'
          : 'Sign in to keep this between sessions.'}
      </Text>
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: 26,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: C.prompt,
  },
  options: {
    marginTop: 22,
    gap: 10,
  },
  // The existing selection idiom, borrowed from the state pills rather than
  // invented here. This is a functional pass, not a design one.
  option: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: C.chipSurface,
    borderColor: C.chipBorder,
  },
  optionSelected: {
    backgroundColor: C.chipSelectedSurface,
    borderColor: C.chipSelectedBorder,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: C.chipText,
  },
  optionLabelSelected: {
    color: C.chipSelectedText,
    fontWeight: '500',
  },
  note: {
    marginTop: 18,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: C.placeholder,
  },
});
