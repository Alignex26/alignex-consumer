import { Pressable, StyleSheet, Text } from 'react-native';

import { ElseaEntryS2, ElseaEntryS2Color, ElseaFontScaleCap } from '@/constants/elsea';

type Props = {
  label: string;
  selected?: boolean;
  /** `More` is the same family, one step quieter. */
  quiet?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
};

const C = ElseaEntryS2Color;

/**
 * The illuminated fill for the selected pill.
 *
 * Drawn with React Native's native `experimental_backgroundImage`, the same
 * primitive the fields and the CTA already use, so no gradient package is
 * introduced. Violet into a warmer lilac, both below full opacity so the fill
 * lights up without becoming a second CTA.
 */
const SELECTED_FILL = {
  type: 'linear-gradient' as const,
  direction: '120deg',
  colorStops: [
    { color: C.pillSelectedFrom, positions: ['0%'] },
    { color: C.pillSelectedTo, positions: ['100%'] },
  ],
};

/**
 * A state pill — a way to start without writing anything.
 *
 * Text only. No icon, no emoji, no illustration, and not a card: the previous
 * chips carried more chrome than the choice needs, and a grid of nine
 * illuminated controls is exactly the neon interface the direction rules out.
 *
 * Only selection lights up. Everything else on this screen is dark fill with a
 * subtle violet outline, so the one pill you have chosen is legible at a
 * glance without any other control competing.
 *
 * The pill is 48pt tall in every state — above the 44pt minimum, and constant,
 * so selecting one never reflows the grid. Selection is announced to assistive
 * technology rather than being carried by colour alone, and there is no tick.
 */
export function ElseaStatePill({
  label,
  selected = false,
  quiet = false,
  onPress,
  accessibilityHint,
}: Props) {
  const border = selected
    ? C.pillSelectedBorder
    : quiet
      ? C.pillQuietBorder
      : C.pillBorder;
  const text = selected ? C.pillSelectedText : quiet ? C.pillQuietText : C.pillText;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.pill,
        { borderColor: border },
        selected
          ? [styles.selected, { experimental_backgroundImage: [SELECTED_FILL] }]
          : { backgroundColor: C.pillSurface },
        pressed && styles.pressed,
      ]}>
      <Text
        style={[styles.label, { color: text }]}
        numberOfLines={1}
        maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    // Equal columns come from the row, not from a width here.
    flex: 1,
    height: ElseaEntryS2.pillHeight,
    borderRadius: ElseaEntryS2.pillRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  /** Small and restrained. A halo, not a light source. */
  selected: {
    shadowColor: C.pillGlow,
    shadowOpacity: 0.34,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: ElseaEntryS2.pillTextSize,
    fontWeight: '500',
  },
});
