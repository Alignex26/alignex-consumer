import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  ElseaArrivalColor,
  ElseaColor,
  ElseaS02Color,
  ElseaFontScaleCap,
  ElseaMotion,
  ElseaRadius,
  ElseaSize,
  ElseaSurfaceAlpha,
  ElseaTextAlpha,
  ElseaType,
  withAlpha,
} from '@/constants/elsea';

type Props = {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  disabled?: boolean;
  /** Defaults to Screen 01's 18. Screen 02's Continue uses 20. */
  borderRadius?: number;
  /** Screen 01 lifts the action off the field; Screen 02's spec has no shadow. */
  elevated?: boolean;
  /**
   * `lilac` is Screen 01's; `gradientViolet` is Screen 02's Continue. `pale`
   * and `violet` predate them and are kept so nothing else has to change.
   */
  tone?: 'pale' | 'violet' | 'lilac' | 'gradientViolet';
  /** Defaults to 58. Screen 01's reference CTA is 54. */
  height?: number;
  /** Defaults to 17/22. Screen 01's reference CTA is 15/20. */
  fontSize?: number;
  lineHeight?: number;
};

const TONE = {
  pale: {
    surface: ElseaColor.surface,
    surfacePressed: ElseaColor.surfacePressed,
    label: ElseaColor.onSurface,
    disabledSurface: withAlpha(ElseaColor.surface, ElseaSurfaceAlpha.actionDisabled),
    disabledLabel: withAlpha(ElseaColor.pale, ElseaTextAlpha.disabledLabel),
  },
  violet: {
    surface: ElseaColor.actionViolet,
    surfacePressed: ElseaColor.actionVioletPressed,
    label: ElseaColor.onActionViolet,
    disabledSurface: withAlpha(ElseaColor.actionViolet, ElseaSurfaceAlpha.actionDisabled),
    disabledLabel: withAlpha(ElseaColor.pale, ElseaTextAlpha.disabledLabel),
  },
  // Screen 01's pale-lilac reference button.
  lilac: {
    surface: ElseaArrivalColor.paleLilac,
    surfacePressed: '#D8C9F5',
    label: ElseaArrivalColor.ctaText,
    disabledSurface: withAlpha(ElseaArrivalColor.paleLilac, ElseaSurfaceAlpha.actionDisabled),
    disabledLabel: withAlpha(ElseaArrivalColor.offWhite, ElseaTextAlpha.disabledLabel),
  },
  // Screen 02's luminous Continue. The gradient is drawn with React Native's
  // native `experimental_backgroundImage` — the same primitive both screens'
  // fields already use, so no gradient package is introduced.
  gradientViolet: {
    surface: ElseaS02Color.ctaSolid,
    surfacePressed: ElseaS02Color.ctaFrom,
    label: ElseaS02Color.ctaLabel,
    disabledSurface: ElseaS02Color.ctaDisabledSurface,
    disabledLabel: ElseaS02Color.ctaDisabledLabel,
    gradient: {
      type: 'linear-gradient' as const,
      // Left to right, with only a slight diagonal bias.
      direction: '100deg',
      colorStops: [
        { color: ElseaS02Color.ctaFrom, positions: ['0%'] },
        { color: ElseaS02Color.ctaTo, positions: ['100%'] },
      ],
    },
  },
} as const;

/**
 * The luminous primary action.
 *
 * A pale surface lifted off the field by a wide, soft, purple-black shadow —
 * not a glow and not a glass panel. Press response is a small darkening plus a
 * barely-there scale, eased over 120ms. Never springy.
 *
 * Disabled drops the surface back into the field and removes the shadow, so it
 * reads as not-yet-available rather than as a button that failed. The state is
 * exposed to assistive technology, never conveyed by colour alone.
 */
export function ElseaPrimaryAction({
  label,
  onPress,
  accessibilityHint,
  disabled = false,
  borderRadius = ElseaRadius.action,
  elevated = true,
  tone = 'pale',
  height = ElseaSize.actionHeight,
  fontSize = ElseaType.buttonSize,
  lineHeight = ElseaType.buttonLeading,
}: Props) {
  const palette = TONE[tone];
  const gradient = 'gradient' in palette ? palette.gradient : undefined;
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  // Not memoised on purpose: the React Compiler handles that, and wrapping
  // these in useCallback would mean passing the shared value into a hook that
  // then mutates it.
  const onPressIn = () => {
    pressed.value = withTiming(1, { duration: ElseaMotion.pressDuration });
  };

  const onPressOut = () => {
    pressed.value = withTiming(0, { duration: ElseaMotion.pressDuration });
  };

  const animatedStyle = useAnimatedStyle(() => {
    // Reduce Motion keeps the surface feedback but drops the movement.
    const transform = reduceMotion ? [] : [{ scale: 1 - pressed.value * 0.006 }];

    // A gradient surface cannot be cross-faded through `backgroundColor`, so it
    // takes its press feedback as a small dip in opacity instead. `gradient` is
    // fixed for the life of the component, so the returned keys are stable.
    if (gradient) {
      return { transform, opacity: 1 - pressed.value * 0.12 };
    }

    return {
      transform,
      backgroundColor: interpolateColor(
        pressed.value,
        [0, 1],
        [palette.surface, palette.surfacePressed]
      ),
    };
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={styles.hitArea}>
      <Animated.View
        style={
          disabled
            ? [styles.surfaceBase, { height, borderRadius, backgroundColor: palette.disabledSurface }]
            : [
                styles.surfaceBase,
                elevated && styles.elevated,
                { height, borderRadius },
                gradient && { experimental_backgroundImage: [gradient] },
                animatedStyle,
              ]
        }>
        <Text
          style={[
            styles.label,
            { fontSize, lineHeight, color: disabled ? palette.disabledLabel : palette.label },
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={ElseaFontScaleCap.action}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    minHeight: ElseaSize.minTouchTarget,
  },
  surfaceBase: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  elevated: {
    shadowColor: ElseaColor.ink,
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
  },
  label: {
    fontWeight: '600',
  },
});
