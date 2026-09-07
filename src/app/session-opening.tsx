import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { ElseaConversationField } from '@/components/elsea/elsea-conversation-field';
import { SESSION_OPENING } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import { useFlowGuard } from '@/flow/use-flow-guard';
import { useElseaLayout } from '@/layout/use-elsea-layout';
import { trackScreen } from '@/lib/analytics';
import { replaceWith } from '@/navigation/elsea-routes';
import { useSessionFlow } from '@/state/session-flow';
import { isTransitionKey } from '@/types/elsea';

const C = ElseaS02Color;

/** Long enough to read the line and settle; short enough not to be a wait. */
const OPENING_MS = 3200;

/**
 * SCREEN 08 — SESSION OPENING.
 *
 * The step out of the interface and into the experience. One line, a lot of
 * space, and then it goes.
 *
 * The whole screen is tappable so nobody has to sit through it, and Reduce
 * Motion shortens the beat rather than removing it — the transition still
 * needs to happen, it just should not linger.
 */
export default function SessionOpeningScreen() {
  const ready = useFlowGuard('session');
  const { interpretation } = useSessionFlow();
  const { insets } = useElseaLayout();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    trackScreen('session_opening');
  }, []);

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => replaceWith('session'), reduceMotion ? 1200 : OPENING_MS);
    return () => clearTimeout(id);
  }, [ready, reduceMotion]);

  if (!ready) return null;

  const key = interpretation?.transitionKey;
  const line = key && isTransitionKey(key) ? SESSION_OPENING[key] : '';

  return (
    <Pressable
      style={styles.root}
      onPress={() => replaceWith('session')}
      accessibilityRole="button"
      accessibilityLabel="Begin the session now">
      <ElseaConversationField />
      <StatusBar style="light" />

      <View style={[styles.centre, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View entering={FadeIn.duration(900)}>
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
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '500',
    letterSpacing: -0.3,
    textAlign: 'center',
    color: '#FAF8FC',
  },
});
