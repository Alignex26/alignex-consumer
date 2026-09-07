import { StyleSheet, Text, View } from 'react-native';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { AudioPrepCopy } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import { useFlowGuard } from '@/flow/use-flow-guard';
import { navigateTo } from '@/navigation/elsea-routes';
import { useSessionFlow } from '@/state/session-flow';

const C = ElseaS02Color;

/**
 * SCREEN 07 — BEFORE WE START.
 *
 * Two lines and a button. The headphones line appears only for sessions the
 * catalogue actually marks as needing them, rather than being shown to
 * everyone as boilerplate.
 *
 * Nothing here makes a claim about how the audio works. No frequencies, no
 * entrainment, no Hz — none of that is approved, so none of it is said.
 */
export default function AudioPrepScreen() {
  const ready = useFlowGuard('session');
  const { selectedSession } = useSessionFlow();

  if (!ready || !selectedSession) return null;

  return (
    <ElseaScreen
      screen="audio_prep"
      onBack={goBack}
      heading={AudioPrepCopy.heading}
      action={
        <ElseaFlowAction
          label={AudioPrepCopy.primaryAction}
          onPress={() => navigateTo('sessionOpening')}
        />
      }>
      <View style={styles.lines}>
        {selectedSession.requiresHeadphones ? (
          <Text style={styles.line} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
            {AudioPrepCopy.headphones}
          </Text>
        ) : null}
        <Text style={styles.line} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
          {AudioPrepCopy.volume}
        </Text>
      </View>
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  lines: {
    marginTop: 26,
    gap: 12,
  },
  line: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400',
    color: C.prompt,
  },
});
