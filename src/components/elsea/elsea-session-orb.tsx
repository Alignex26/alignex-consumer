import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ElseaS02Color, withAlpha } from '@/constants/elsea';

const C = ElseaS02Color;

type Props = {
  size: number;
  /** Movement continues only while the session is actually running. */
  active: boolean;
};

/**
 * The session's central form.
 *
 * VISUAL POLISH REQUIRED — this is a restrained placeholder, not the finished
 * centrepiece. It is built from three layered radial gradients breathing at
 * different rates and slightly different centres, which reads as one soft
 * organic mass rather than a set of circles. No graphics dependency was
 * installed for it: it uses the same native gradient primitive as both
 * screens' backgrounds.
 *
 * Deliberately not: a waveform, an equaliser, a frequency graph, a brain, a
 * lotus, or a person meditating.
 *
 * When the session is paused the movement settles rather than freezing mid-
 * breath. When Reduce Motion is on there is no movement at all — the form is
 * simply present, which is also what it does while paused.
 */
export function ElseaSessionOrb({ size, active }: Props) {
  const reduceMotion = useReducedMotion();

  const slow = useSharedValue(0);
  const mid = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || !active) {
      // Settle back to the resting shape over a beat rather than stopping dead.
      slow.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.ease) });
      mid.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.ease) });
      drift.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.ease) });
      return;
    }

    slow.value = withRepeat(
      withTiming(1, { duration: 7200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    mid.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    drift.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [active, reduceMotion, slow, mid, drift]);

  const core = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + slow.value * 0.12 }],
    opacity: 0.68 + slow.value * 0.2,
  }));

  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + mid.value * 0.1 }],
    opacity: 0.3 + mid.value * 0.22,
  }));

  const wander = useAnimatedStyle(() => ({
    transform: [
      { translateX: -size * 0.04 + drift.value * size * 0.08 },
      { translateY: size * 0.03 - drift.value * size * 0.07 },
      { scale: 0.82 + drift.value * 0.16 },
    ],
    opacity: 0.24 + drift.value * 0.2,
  }));

  const circle = (diameter: number, hex: string, inner: number) => ({
    position: 'absolute' as const,
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    experimental_backgroundImage: [
      {
        type: 'radial-gradient' as const,
        shape: 'circle' as const,
        size: { x: '50%', y: '50%' },
        position: { top: '50%', left: '50%' },
        colorStops: [
          { color: withAlpha(hex, inner), positions: ['0%'] },
          { color: withAlpha(hex, inner * 0.72), positions: ['42%'] },
          { color: withAlpha(hex, inner * 0.3), positions: ['70%'] },
          { color: withAlpha(hex, 0), positions: ['100%'] },
        ],
      },
    ],
  });

  return (
    <View
      style={[styles.stage, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={[circle(size, C.atmosphereViolet, 0.9), halo]} />
      <Animated.View style={[circle(size * 0.82, C.violetTrace, 0.7), wander]} />
      <Animated.View style={[circle(size * 0.6, '#B58AFF', 0.55), core]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
