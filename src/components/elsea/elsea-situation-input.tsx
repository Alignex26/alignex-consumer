import { useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { PRODUCT_NAME } from '@/constants/brand';
import { ElseaFontScaleCap, ElseaS02, ElseaS02Color } from '@/constants/elsea';

/**
 * The canonical example. Deliberately a whole real situation, not a prompt.
 *
 * Written as one continuous string: it wraps naturally to whatever the device
 * width allows. The reference's three lines are what it happens to look like at
 * the canonical width, not a line structure to force.
 */
export const SITUATION_PLACEHOLDER = `Tell ${PRODUCT_NAME} what’s happening... (e.g. “Work was intense and I can’t switch off”)`;

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  /** Height is chosen by the screen from its width and height classes. */
  height: number;
  /** Placeholder and typed text step with the width class. */
  fontSize: number;
  lineHeight: number;
  style?: StyleProp<ViewStyle>;
};

const C = ElseaS02Color;

/**
 * The listening surface — the dominant element of Screen 02.
 *
 * A pale lilac field sitting inside the dark violet environment: matte and
 * luminous rather than white, grey, glass or translucent black, so it reads as
 * an illuminated surface the person writes onto. No shadow, no outer glow, no
 * microphone, no counter.
 *
 * Focus moves the hairline from white to lilac. Only the colour changes —
 * the width is constant, so nothing shifts as the border lights up.
 */
export function ElseaSituationInput({
  value,
  onChangeText,
  height,
  fontSize,
  lineHeight,
  style,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        { height, borderColor: focused ? C.inputBorderFocused : C.inputBorder },
        style,
      ]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={SITUATION_PLACEHOLDER}
        placeholderTextColor={C.placeholder}
        style={[styles.input, { fontSize, lineHeight }]}
        multiline
        textAlignVertical="top"
        autoCapitalize="sentences"
        autoCorrect
        keyboardType="default"
        keyboardAppearance="light"
        // Return inserts a newline; it never submits. (`submitBehavior`
        // supersedes the deprecated `blurOnSubmit`.)
        submitBehavior="newline"
        selectionColor={C.ctaSolid}
        maxFontSizeMultiplier={ElseaFontScaleCap.input}
        accessibilityLabel={`Tell ${PRODUCT_NAME} what's going on`}
        accessibilityHint="Describe what's happening in your own words."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: ElseaS02.inputRadius,
    backgroundColor: C.inputSurface,
    borderWidth: 1,
    padding: ElseaS02.inputPadding,
  },
  input: {
    flex: 1,
    width: '100%',
    fontWeight: '400',
    color: C.inputText,
    padding: 0,
  },
});
