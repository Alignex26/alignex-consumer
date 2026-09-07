import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ElseaFontScaleCap, ElseaS02Color, ElseaSize, withAlpha } from '@/constants/elsea';

const C = ElseaS02Color;

type Props = {
  title: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  accessibilityHint?: string;
};

/**
 * A stacked rounded choice card — the time options, and the state options on
 * the correction screen.
 *
 * Selection is carried by surface, border AND the accessibility selected
 * state, never by colour alone. Nothing about the card changes size when it is
 * chosen, so a list does not reflow under the finger.
 */
export function ElseaChoiceCard({ title, detail, selected, onPress, accessibilityHint }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, checked: selected }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: selected ? C.chipSelectedSurface : C.chipSurface,
          borderColor: selected ? C.chipSelectedBorder : C.chipBorder,
        },
        pressed && styles.pressed,
      ]}>
      <View style={styles.text}>
        <Text
          style={[styles.title, { color: selected ? C.chipSelectedText : C.chipText }]}
          maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
          {title}
        </Text>
        {detail ? (
          <Text style={styles.detail} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  text: {
    minHeight: ElseaSize.minTouchTarget - 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  detail: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: withAlpha('#C7BDD7', 0.86),
  },
});
