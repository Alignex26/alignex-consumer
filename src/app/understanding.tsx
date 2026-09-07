import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';

import { ElseaConversationField } from '@/components/elsea/elsea-conversation-field';
import { ElseaHeading } from '@/components/elsea/elsea-heading';
import { UnderstandingCopy } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import { useElseaLayout } from '@/layout/use-elsea-layout';
import { track, trackScreen } from '@/lib/analytics';
import { checkAndInterpret } from '@/lib/interpret-service';
import { stateForShortcut } from '@/lib/shortcuts';
import { replaceWith } from '@/navigation/elsea-routes';
import { useAuth } from '@/state/auth';
import { hasMeaningfulText, useSessionDraft } from '@/state/session-draft';
import { useSessionFlow } from '@/state/session-flow';

const C = ElseaS02Color;

/**
 * SCREEN 03 — UNDERSTANDING.
 *
 * A calm place to be while the safety gate and the interpreter run. It is not
 * a loading screen pretending to be something else: there is no percentage, no
 * fake progress, and no timer deciding when to move on. The screen waits for
 * the real pipeline and then leaves.
 *
 * ROUTING, and why each branch goes where it does:
 *
 *   interpreted   → Screen 04. Safety cleared, and we understood.
 *   needs_picker  → the correction screen. Safety cleared, but we did not
 *                   understand well enough to put words in someone's mouth,
 *                   so they choose. A normal path, not an error.
 *   diverted      → Support. This covers both "the gate flagged it" and "the
 *                   gate could not run" — the two are indistinguishable here
 *                   on purpose, so a technical failure can never be treated
 *                   as permission to continue.
 *
 * The person's text is passed to the service and nowhere else. It is not
 * logged, and the analytics event below records only that a check happened
 * and how it resolved.
 */
export default function UnderstandingScreen() {
  const { insets } = useElseaLayout();
  const reduceMotion = useReducedMotion();
  const { situationText, shortcut } = useSessionDraft();
  const { userId } = useAuth();
  const { setInterpretation, clearSafety, setFailure, reset } = useSessionFlow();

  // The pipeline runs exactly once per visit to this screen. Without this a
  // re-render on focus could fire a second safety call for the same input.
  const started = useRef(false);

  const breath = useSharedValue(0);

  useEffect(() => {
    trackScreen('understanding');
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [breath, reduceMotion]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    const run = async () => {
      const text = situationText;
      const hasText = hasMeaningfulText(text);
      const shortcutState = stateForShortcut(shortcut);

      // Nothing to work with at all. Go back rather than call anything.
      if (!hasText && !shortcutState) {
        if (!cancelled) router.replace('/whats-going-on');
        return;
      }

      // A chip on its own carries no content for the gate to read, so it goes
      // straight to the manual picker. See `@/lib/shortcuts`.
      if (!hasText) {
        if (!cancelled) replaceWith('correction');
        return;
      }

      const outcome = await checkAndInterpret(text, userId);
      if (cancelled) return;

      if (outcome.kind === 'diverted') {
        track({ name: 'safety_check_completed', result: 'diverted' });
        // Everything about this attempt is dropped on a diversion.
        reset();
        replaceWith('support');
        return;
      }

      track({ name: 'safety_check_completed', result: 'passed' });
      clearSafety();

      if (outcome.kind === 'needs_picker') {
        setFailure(null);
        replaceWith('correction');
        return;
      }

      setInterpretation(outcome.interpretation);
      track({
        name: 'interpretation_presented',
        transition: outcome.interpretation.transitionKey,
      });
      replaceWith('interpretation');
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [situationText, shortcut, userId, setInterpretation, clearSafety, setFailure, reset]);

  const breathing = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.5 : 0.32 + breath.value * 0.26,
    transform: reduceMotion ? [] : [{ scale: 0.94 + breath.value * 0.1 }],
  }));

  return (
    <View style={styles.root}>
      <ElseaConversationField />
      <StatusBar style="light" />

      <View style={[styles.centre, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* A slow presence rather than a spinner. It says "something is
            happening" without pretending to know how long it will take. */}
        <Animated.View style={[styles.presence, breathing]} />

        <Animated.View entering={FadeIn.duration(400)} style={styles.text}>
          <ElseaHeading style={styles.heading}>{UnderstandingCopy.heading}</ElseaHeading>
          <Text
            style={styles.supporting}
            maxFontSizeMultiplier={ElseaFontScaleCap.supporting}
            accessibilityLiveRegion="polite">
            {UnderstandingCopy.supporting}
          </Text>
        </Animated.View>
      </View>
    </View>
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
    paddingHorizontal: 32,
  },
  presence: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: C.atmosphereViolet,
  },
  text: {
    alignItems: 'center',
  },
  heading: {
    textAlign: 'center',
  },
  supporting: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    textAlign: 'center',
    color: C.prompt,
  },
});
