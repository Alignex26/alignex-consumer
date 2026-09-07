import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { ElseaConversationField } from '@/components/elsea/elsea-conversation-field';
import { SESSION_ARRIVAL } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import { useFlowGuard } from '@/flow/use-flow-guard';
import { useElseaLayout } from '@/layout/use-elsea-layout';
import { trackScreen } from '@/lib/analytics';
import { replaceWith } from '@/navigation/elsea-routes';
import { useSessionFlow } from '@/state/session-flow';
import { isTransitionKey } from '@/types/elsea';

const C = ElseaS02Color;

/** Long enough to land, short enough not to become a wait. */
const ARRIVAL_MS = 3600;

/**
 * SCREEN 12 — ARRIVAL.
 *
 * A moment before the question. Someone has just finished a session; putting a
 * form in front of them immediately would waste what just happened.
 *
 * No celebration, no confetti, no badge, no score. One line and a pause.
 */
export default function ArrivalScreen() {
  const ready = useFlowGuard('run');
  const { interpretation } = useSessionFlow();
  const { insets } = useElseaLayout();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    trackScreen('arrival_result');
  }, []);

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => replaceWith('outcome'), reduceMotion ? 1400 : ARRIVAL_MS);
    return () => clearTimeout(id);
  }, [ready, reduceMotion]);

  if (!ready) return null;

  const key = interpretation?.transitionKey;
  const line = key && isTransitionKey(key) ? SESSION_ARRIVAL[key] : '';

  return (
    <Pressable
      style={styles.root}
      onPress={() => replaceWith('outcome')}
      accessibilityRole="button"
      accessibilityLabel="Continue">
      <ElseaConversationField />
      <StatusBar style="light" />

      <View style={[styles.centre, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View entering={FadeIn.duration(1100)}>
          <Text style={styles.line} maxFontSizeMultiplier={ElseaFontScaleCap.headline}>
            {line}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.base,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  line: {
    fontSize: 29,
    lineHeight: 36,
    fontWeight: '500',
    letterSpacing: -0.3,
    textAlign: 'center',
    color: '#FAF8FC',
  },
});
