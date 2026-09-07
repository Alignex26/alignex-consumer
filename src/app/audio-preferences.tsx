import { StyleSheet, Text } from 'react-native';

import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { YouCopy } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';

const C = ElseaS02Color;

/**
 * SCREEN 20 — AUDIO PREFERENCES.
 *
 * PRODUCT DECISION REQUIRED.
 *
 * The concept artwork showed voice, music and breathing-guidance controls, but
 * the session engine has no notion of any of them: `sessions_catalogue` carries
 * a duration, an intensity and a headphones flag, and `session_segments` a
 * single audio path. There is nothing to toggle.
 *
 * Exposing three switches that change nothing would be worse than an empty
 * screen, so this is the route and the shell only. When the session model gains
 * controllable variants, the controls belong here.
 */
export default function AudioPreferencesScreen() {
  return (
    <ElseaScreen screen="audio_preferences" onBack={goBack} heading={YouCopy.audioHeading}>
      <Text style={styles.body} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
        Nothing to adjust yet.
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
});
