import { useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { PRODUCT_NAME } from '@/constants/brand';
import { ElseaEntryS2, ElseaEntryS2Color, ElseaFontScaleCap } from '@/constants/elsea';

/** The field's own prompt. Short, so the surface stays quiet before typing. */
export const SITUATION_PLACEHOLDER = 'Type here...';

/**
 * The canonical example, kept but demoted.
 *
 * It used to live inside the placeholder, where a whole worked situation was
 * the loudest text on the screen. It now sits under the field as helper text
 * at a smaller size and lower contrast: still there for someone who cannot
 * find the words, no longer competing with the field itself.
 */
export const SITUATION_EXAMPLE = 'e.g. “Work was intense and I can’t switch off”';

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

const C = ElseaEntryS2Color;

/**
 * The listening surface.
 *
 * Midnight indigo with a very subtle violet hairline and a large radius — it
 * belongs to the dark interface rather than sitting on top of it. The pale
 * lilac block this replaces was the one element that broke the composition:
 * at roughly a quarter of the screen it dominated everything, and a light
 * surface that size cannot be toned into a dark screen.
 *
 * No glass, no blur, no fill glow, no microphone, no counter. Focus brightens
 * the hairline and nothing else — the width is constant, so nothing shifts.
 *
 * Behaviour is unchanged from the pale version: free text, multiline, Return
 * inserts a newline and never submits, and nothing is interpreted here.
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
        // Follows the surface. A light keyboard under a dark field was the
        // giveaway that the pale block was still setting the tone.
        keyboardAppearance="dark"
        // Return inserts a newline; it never submits. (`submitBehavior`
        // supersedes the deprecated `blurOnSubmit`.)
        submitBehavior="newline"
        selectionColor={C.pillSelectedBorder}
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
    borderRadius: ElseaEntryS2.inputRadius,
    backgroundColor: C.inputSurface,
    borderWidth: 1,
    padding: ElseaEntryS2.inputPadding,
  },
  input: {
    flex: 1,
    width: '100%',
    fontWeight: '400',
    color: C.inputText,
    padding: 0,
  },
});
