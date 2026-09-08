import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ElseaFontScaleCap, ElseaTarget, ElseaWelcomeColor } from '@/constants/elsea';

const C = ElseaWelcomeColor;
const T = ElseaTarget;

/** Selected chips carry Screen 1's blue-lavender-pink ramp, left to right. */
const SELECTED_FILL = {
  type: 'linear-gradient' as const,
  direction: '100deg',
  colorStops: [
    { color: C.electricBlue, positions: ['0%'] },
    { color: C.lavender, positions: ['52%'] },
    { color: C.softPink, positions: ['100%'] },
  ],
};

type Props = {
  /** The large line — a duration range, or a word for the open option. */
  value: string;
  /** The small line beneath it. Empty for the open option. */
  unit: string;
  selected: boolean;
  /** False where the option is not yet a valid engine input. */
  available: boolean;
  accessibilityLabel: string;
  /** Shorter on a compact screen. */
  height: number;
  valueSize: number;
  unitSize: number;
  onPress: () => void;
};

/**
 * One of the four available-time selectors.
 *
 * Two stacked lines, matching the reference's treatment: the figure carries
 * the weight and the unit sits quietly beneath it.
 */
export function ElseaTimeChip({
  value,
  unit,
  selected,
  available,
  accessibilityLabel,
  height,
  valueSize,
  unitSize,
  onPress,
}: Props) {
  const surface: ViewStyle = selected
    ? { borderColor: '#D9C6FF', experimental_backgroundImage: [SELECTED_FILL] }
    : { borderColor: T.chipBorder, backgroundColor: T.chipSurface };

  return (
    <Pressable
      onPress={available ? onPress : undefined}
      disabled={!available}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={available ? undefined : 'Not available yet.'}
      accessibilityState={{ selected, checked: selected, disabled: !available }}
      style={({ pressed }) => [
        styles.chip,
        { height, opacity: available ? 1 : 0.34 },
        surface,
        selected && styles.selectedLift,
        pressed && styles.pressed,
      ]}>
      <View style={styles.stack}>
        <Text
          style={[
            styles.value,
            { fontSize: valueSize, color: selected ? C.ctaLabel : C.offWhite },
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
          {value}
        </Text>
        {unit ? (
          <Text
            style={[
              styles.unit,
              { fontSize: unitSize, color: selected ? 'rgba(11,10,24,0.72)' : C.muted },
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
            {unit}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    borderRadius: T.chipRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectedLift: {
    shadowColor: '#7C42E8',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  pressed: {
    opacity: 0.8,
  },
  stack: {
    alignItems: 'center',
    gap: 1,
  },
  value: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  unit: {
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});
