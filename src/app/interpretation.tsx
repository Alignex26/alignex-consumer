import { StyleSheet, Text, View } from 'react-native';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen } from '@/components/elsea/elsea-screen';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import { InterpretationCopy, TRANSITION_READBACK } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import { useFlowGuard } from '@/flow/use-flow-guard';
import { track } from '@/lib/analytics';
import { navigateTo } from '@/navigation/elsea-routes';
import { useSessionFlow } from '@/state/session-flow';

const C = ElseaS02Color;

/**
 * SCREEN 04 — WE UNDERSTOOD.
 *
 * NO LONGER ON THE MAIN PATH. Target + time absorbed the confirm step, so the
 * gate routes straight there. Left in place rather than deleted: it is built
 * and reviewed, and its readback is the only place the interpretation is put
 * into words. Nothing navigates to it today.
 *
 * ELSEA says back what it thinks is happening, in ordinary language, and the
 * person says whether that is right.
 *
 * What is deliberately absent: no JSON, no confidence figure, no model output,
 * no clinical label, and nothing that says "AI". The person sees two
 * sentences. The taxonomy behind them stays behind them.
 *
 * Guarded on a *safe* interpretation, so this cannot be reached by navigating
 * straight here.
 */
export default function InterpretationScreen() {
  const ready = useFlowGuard('safe_interpretation');
  const { interpretation } = useSessionFlow();

  if (!ready || !interpretation) return null;

  const readback = TRANSITION_READBACK[interpretation.transitionKey];

  const confirm = () => {
    track({ name: 'interpretation_confirmed', transition: interpretation.transitionKey });
    navigateTo('time');
  };

  const correct = () => {
    track({ name: 'interpretation_corrected', transition: interpretation.transitionKey });
    navigateTo('correction');
  };

  return (
    <ElseaScreen
      screen="interpretation"
      action={
        <View>
          <ElseaFlowAction
            label={InterpretationCopy.confirm}
            onPress={confirm}
            accessibilityHint="Continues to choosing how much time you have."
          />
          <View style={styles.secondary}>
            <ElseaTextAction
              label={InterpretationCopy.correct}
              onPress={correct}
              accessibilityHint="Lets you change what ELSEA understood."
            />
          </View>
        </View>
      }>
      <Text style={styles.context} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
        {InterpretationCopy.contextLine}
      </Text>

      {/*
        Current state, then the movement, then the desired state. The pair is
        grouped for assistive technology so it is read as one statement rather
        than three unrelated fragments.
      */}
      <View style={styles.readback} accessible accessibilityRole="text">
        <Text style={styles.from} maxFontSizeMultiplier={ElseaFontScaleCap.headline}>
          {readback.from}
        </Text>
        <View style={styles.movement} accessibilityElementsHidden importantForAccessibility="no">
          <View style={styles.line} />
        </View>
        <Text style={styles.to} maxFontSizeMultiplier={ElseaFontScaleCap.headline}>
          {readback.to}
        </Text>
      </View>
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  context: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: C.prompt,
  },
  readback: {
    marginTop: 28,
  },
  from: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.35,
    color: '#FAF8FC',
  },
  movement: {
    height: 34,
    justifyContent: 'center',
  },
  line: {
    width: 1,
    height: 26,
    marginLeft: 2,
    backgroundColor: C.chipSelectedBorder,
  },
  to: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.35,
    color: '#FAF8FC',
  },
  secondary: {
    marginTop: 10,
  },
});
