import { Pressable, StyleSheet, Text } from 'react-native';

import { ElseaFontScaleCap, ElseaS02, ElseaS02Color, ElseaSize } from '@/constants/elsea';

type Props = {
  label: string;
  selected?: boolean;
  /** `More options` is the same chip family, one step quieter. */
  quiet?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
};

const C = ElseaS02Color;

/**
 * Vertical hitSlop, rather than a taller wrapper, is what takes the 34pt chip
 * up to the 44pt minimum target. A wrapper would occupy 44pt in the layout and
 * turn the specified 8pt row gap into an 18pt one; hitSlop extends the touch
 * area without occupying any space, so the visual rhythm is exactly as
 * specified and the target still clears the minimum.
 */
const VERTICAL_SLOP = (ElseaSize.minTouchTarget - ElseaS02.chipHeight) / 2;

/**
 * A shortcut chip — a way to say how you feel without writing anything.
 *
 * The chip is 34pt tall in every state; selection changes only surface, border
 * and label. Selection is announced to assistive technology rather than being
 * carried by colour alone, and there is no tick.
 */
export function ElseaShortcutChip({
  label,
  selected = false,
  quiet = false,
  onPress,
  accessibilityHint,
}: Props) {
  const surface = selected ? C.chipSelectedSurface : quiet ? C.moreSurface : C.chipSurface;
  const border = selected ? C.chipSelectedBorder : quiet ? C.moreBorder : C.chipBorder;
  const text = selected ? C.chipSelectedText : quiet ? C.moreText : C.chipText;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      hitSlop={{ top: VERTICAL_SLOP, bottom: VERTICAL_SLOP }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: surface, borderColor: border },
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
  chip: {
    height: ElseaS02.chipHeight,
    paddingHorizontal: ElseaS02.chipPaddingX,
    borderRadius: ElseaS02.chipRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: ElseaS02.chipTextSize,
    fontWeight: '500',
  },
});
