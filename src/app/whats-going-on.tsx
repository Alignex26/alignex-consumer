import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { ElseaBackButton } from '@/components/elsea/elsea-back-button';
import { ElseaConversationField } from '@/components/elsea/elsea-conversation-field';
import { ElseaHeading } from '@/components/elsea/elsea-heading';
import { ElseaPrimaryAction } from '@/components/elsea/elsea-primary-action';
import { ElseaShortcutChip } from '@/components/elsea/elsea-shortcut-chip';
import { ElseaSituationInput } from '@/components/elsea/elsea-situation-input';
import {
  ELSEA_SHORTCUTS,
  ElseaFontScaleCap,
  ElseaMotion,
  ElseaS02,
  ElseaS02Color,
  ElseaS02Metric,
} from '@/constants/elsea';
import { useElseaLayout } from '@/layout/use-elsea-layout';
import { track } from '@/lib/analytics';
import { useKeyboardHeight } from '@/layout/use-keyboard-height';
import { navigateTo } from '@/navigation/elsea-routes';
import { hasMeaningfulText, useSessionDraft } from '@/state/session-draft';

const C = ElseaS02Color;

/**
 * SCREEN 02 — WHAT'S GOING ON?
 *
 * Where the person says what is actually happening. Free text is primary; the
 * shortcut chips are an optional way in for someone who cannot find the words.
 *
 * Everything is in normal layout flow. Nothing below the heading is positioned
 * by coordinate, which is what lets the heading take a second line on a narrow
 * screen and simply push the rest of the screen down.
 */
export default function WhatsGoingOnScreen() {
  const { insets, widthClass, isCompact, horizontalGutter, contentMaxWidth } = useElseaLayout();
  const { height: keyboardHeight } = useKeyboardHeight();
  const reduceMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const { situationText, setSituationText, shortcut, setShortcut } = useSessionDraft();

  const m = ElseaS02Metric[widthClass];

  // Either route in is enough. Neither clears the other: someone can tap a
  // state and then write, or write and then tap, and both are kept.
  const canContinue = hasMeaningfulText(situationText) || shortcut !== null;

  const keyboardUp = keyboardHeight > 0;

  // The listening surface gives ground before anything else does, but never
  // below its floor — several lines of what you are writing stay visible.
  const inputHeight = keyboardUp
    ? Math.max(ElseaS02.inputMinKeyboard, m.inputHeight - 24)
    : isCompact
      ? Math.max(ElseaS02.inputMinCompact, m.inputHeight - 16)
      : m.inputHeight;

  // Scrolling is not part of the composition on a standard or tall screen: it
  // exists only for the cases where the content genuinely cannot fit.
  const mayScroll = isCompact || keyboardUp || fontScale > 1;

  const settle = reduceMotion
    ? FadeIn.duration(ElseaMotion.contentDuration).delay(ElseaMotion.contentDelay)
    : FadeInDown.duration(ElseaMotion.contentDuration)
        .delay(ElseaMotion.contentDelay)
        .withInitialValues({ transform: [{ translateY: ElseaMotion.contentTravel }] });

  const actionSettle = FadeIn.duration(ElseaMotion.contentDuration).delay(
    ElseaMotion.contentDelay + 90
  );

  const onContinue = () => {
    // Both the text and the shortcut are already held in the session draft, so
    // there is nothing to hand over here. Nothing is interpreted on this
    // screen, and nothing goes anywhere near the interpreter from here: the
    // next screen runs the server-side safety gate first.
    track({
      name: 'input_submitted',
      hasText: hasMeaningfulText(situationText),
      hasShortcut: shortcut !== null,
    });
    navigateTo('understanding');
  };

  const onShortcut = (label: string) => {
    // One at a time. Tapping the selected one again clears it.
    setShortcut(shortcut === label ? null : label);
  };

  const onMoreOptions = () => {
    // Deliberately inert: there is no destination for this yet and inventing
    // one is out of scope. Reported rather than wired to something arbitrary.
  };

  const column = {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: horizontalGutter,
  } as const;

  return (
    <View style={styles.root}>
      <ElseaConversationField />
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.flex}
        // Android resizes the window itself; adding padding on top of that
        // would lift the action region twice as far as the keyboard is tall.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={mayScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bounces={false}
          showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={settle}
            style={[column, { paddingTop: insets.top + ElseaS02.backTop }]}>
            <ElseaBackButton onPress={() => router.back()} />

            <ElseaHeading style={{ marginTop: m.backToHeading }}>What&apos;s going on?</ElseaHeading>

            <View style={{ marginTop: m.headingToInput }}>
              <ElseaSituationInput
                value={situationText}
                onChangeText={setSituationText}
                height={inputHeight}
                fontSize={m.placeholderSize}
                lineHeight={m.placeholderLeading}
              />
            </View>

            <Text
              style={[styles.prompt, { marginTop: m.inputToPrompt }]}
              maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
              Or choose how you feel right now:
            </Text>

            {/* Wrapping rows, not a list. Available width decides the breaks. */}
            <View style={styles.chips}>
              {ELSEA_SHORTCUTS.map((label) => (
                <ElseaShortcutChip
                  key={label}
                  label={label}
                  selected={shortcut === label}
                  onPress={() => onShortcut(label)}
                  accessibilityHint="Chooses this as how you feel right now."
                />
              ))}
              <ElseaShortcutChip
                label="More options"
                quiet
                onPress={onMoreOptions}
                accessibilityHint="More ways to describe how you feel. Not available yet."
              />
            </View>
          </Animated.View>

          {/* Flexible space. Collapses first when the keyboard takes the room. */}
          <View style={styles.spacer} />
        </ScrollView>

        <Animated.View
          entering={actionSettle}
          style={[
            column,
            {
              paddingBottom: keyboardUp
                ? ElseaS02.ctaKeyboardClearance
                : insets.bottom + ElseaS02.ctaBottom,
            },
          ]}>
          <ElseaPrimaryAction
            label="Continue"
            disabled={!canContinue}
            tone="gradientViolet"
            height={ElseaS02.ctaHeight}
            borderRadius={ElseaS02.ctaRadius}
            fontSize={ElseaS02.ctaTextSize}
            lineHeight={ElseaS02.ctaTextLeading}
            elevated={false}
            accessibilityHint="Sends what you have written so we can work out what will help."
            onPress={onContinue}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.base,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    // Behaves as a flex column while everything fits; scrolls only when the
    // keyboard or an accessibility text size genuinely leaves too little room.
    flexGrow: 1,
  },
  spacer: {
    flexGrow: 1,
    flexShrink: 1,
  },
  prompt: {
    fontSize: ElseaS02.promptSize,
    lineHeight: ElseaS02.promptLeading,
    fontWeight: '400',
    color: C.prompt,
  },
  chips: {
    marginTop: ElseaS02.chipsTop,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: ElseaS02.chipGap,
    rowGap: ElseaS02.chipGap,
  },
});
