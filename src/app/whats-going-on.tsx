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
import { ElseaHeading } from '@/components/elsea/elsea-heading';
import { ElseaPrimaryAction } from '@/components/elsea/elsea-primary-action';
import { ElseaQuietField } from '@/components/elsea/elsea-quiet-field';
import { ElseaSituationInput, SITUATION_EXAMPLE } from '@/components/elsea/elsea-situation-input';
import { ElseaStatePill } from '@/components/elsea/elsea-state-pill';
import { ElseaWordmark } from '@/components/elsea/elsea-wordmark';
import {
  ELSEA_SHORTCUTS,
  ElseaEntryS2,
  ElseaEntryS2Color,
  ElseaEntryS2Head,
  ElseaFontScaleCap,
  ElseaMotion,
  ElseaS02,
  ElseaS02Metric,
  ElseaSize,
  ElseaWelcome,
  ElseaWelcomeColor,
  ElseaWelcomeType,
} from '@/constants/elsea';
import { useElseaLayout } from '@/layout/use-elsea-layout';
import { useKeyboardHeight } from '@/layout/use-keyboard-height';
import { track } from '@/lib/analytics';
import { navigateTo } from '@/navigation/elsea-routes';
import { hasMeaningfulText, useSessionDraft } from '@/state/session-draft';

const C = ElseaEntryS2Color;
const S = ElseaEntryS2;

/** The one non-canonical control in the grid. Display copy only. */
const MORE = 'More';

/**
 * The nine choices, laid out as three rows of three.
 *
 * Chunked here rather than by wrapping, because a wrapping row cannot
 * guarantee three equal columns: it breaks on measured text width, so
 * "Overwhelmed" and "Low" end up on rows of different lengths. Explicit rows
 * of `flex: 1` pills give the specified grid on every width.
 *
 * The eight canonical shortcuts are unchanged and still carry the selection
 * behaviour; `More` is appended as display copy and remains inert.
 */
const PILL_ROWS: string[][] = (() => {
  const all: string[] = [...ELSEA_SHORTCUTS, MORE];
  const rows: string[][] = [];
  for (let i = 0; i < all.length; i += S.pillColumns) {
    rows.push(all.slice(i, i + S.pillColumns));
  }
  return rows;
})();

/**
 * SCREEN 02 — WHAT'S GOING ON?
 *
 * Where the person says what is actually happening. Free text is primary; the
 * state pills are an optional way in for someone who cannot find the words.
 *
 * Screen 1 is the brand moment; this is the interface, and it is deliberately
 * quieter — a small wordmark rather than a large one, no orb, and only two
 * things on the screen that light up: the pill you have chosen and Continue.
 *
 * Everything is in normal layout flow. Nothing below the heading is positioned
 * by coordinate, which is what lets the heading take a second line on a narrow
 * screen and simply push the rest of the screen down.
 *
 * Behaviour is untouched: both routes in are kept, neither clears the other,
 * nothing is interpreted here, and Continue goes to the screen that runs the
 * server-side safety gate.
 */
export default function WhatsGoingOnScreen() {
  const { insets, widthClass, isCompact, horizontalGutter, contentMaxWidth } = useElseaLayout();
  const { height: keyboardHeight } = useKeyboardHeight();
  const reduceMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const { situationText, setSituationText, shortcut, setShortcut } = useSessionDraft();

  const m = ElseaS02Metric[widthClass];
  const head = ElseaEntryS2Head[widthClass];
  const cta = ElseaWelcomeType[widthClass];

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
      <ElseaQuietField />
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
            style={[column, { paddingTop: insets.top + S.headerTop }]}>
            {/* Header. Chevron, wordmark, and nothing on the right — the
                spacer is what keeps the mark optically centred. */}
            <View style={styles.header}>
              <ElseaBackButton onPress={() => router.back()} />
              <View style={styles.headerCentre}>
                <ElseaWordmark width={S.headerMarkWidth} />
              </View>
              <View style={styles.headerSpacer} />
            </View>

            <ElseaHeading
              style={[styles.heading, { fontSize: head.size, lineHeight: head.leading }]}>
              What&apos;s going on?
            </ElseaHeading>

            <Text
              style={[styles.intro, { marginTop: S.headingToIntro }]}
              maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
              Tell me what’s happening...
            </Text>

            <View style={{ marginTop: S.introToInput }}>
              <ElseaSituationInput
                value={situationText}
                onChangeText={setSituationText}
                height={inputHeight}
                fontSize={m.placeholderSize}
                lineHeight={m.placeholderLeading}
              />
            </View>

            <Text
              style={[styles.example, { marginTop: S.inputToHelper }]}
              maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
              {SITUATION_EXAMPLE}
            </Text>

            <Text
              style={[styles.prompt, { marginTop: S.inputToPrompt }]}
              maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
              Or, start with how you feel
            </Text>

            {/* Three equal columns. Nine choices fill the grid exactly. */}
            <View style={[styles.grid, { marginTop: S.promptToPills }]}>
              {PILL_ROWS.map((row) => (
                <View key={row.join('-')} style={styles.gridRow}>
                  {row.map((label) =>
                    label === MORE ? (
                      <ElseaStatePill
                        key={label}
                        label={label}
                        quiet
                        onPress={onMoreOptions}
                        accessibilityHint="More ways to describe how you feel. Not available yet."
                      />
                    ) : (
                      <ElseaStatePill
                        key={label}
                        label={label}
                        selected={shortcut === label}
                        onPress={() => onShortcut(label)}
                        accessibilityHint="Chooses this as how you feel right now."
                      />
                    )
                  )}
                </View>
              ))}
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
            // The same gradient and the same dark label as Screen 1's CTA:
            // one action language across the entry flow.
            tone="welcome"
            height={ElseaWelcome.ctaHeight}
            borderRadius={ElseaWelcome.ctaRadius}
            fontSize={cta.cta}
            lineHeight={cta.cta * 1.2}
            elevated={false}
            glowColor={canContinue ? ElseaWelcomeColor.lavender : undefined}
            accessibilityHint="Sends what you have written so we can work out what will help."
            onPress={onContinue}
            trailing={
              <Text style={[styles.arrow, { fontSize: cta.cta }]}>→</Text>
            }
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCentre: {
    flex: 1,
    alignItems: 'center',
  },
  /** Balances the back button so the wordmark sits on the true centre. */
  headerSpacer: {
    width: ElseaSize.minTouchTarget,
  },
  /**
   * Overrides the shared heading's weight and scale for this screen only.
   * `ElseaHeading` is used by later screens whose treatment is not in scope,
   * so the lighter, larger setting is applied here rather than to the token.
   */
  heading: {
    marginTop: S.headerToHeading,
    fontWeight: '400',
    letterSpacing: -0.4,
    color: C.heading,
  },
  intro: {
    fontSize: ElseaS02.promptSize,
    lineHeight: ElseaS02.promptLeading,
    fontWeight: '400',
    color: C.intro,
  },
  example: {
    fontSize: S.helperSize,
    lineHeight: S.helperLeading,
    fontWeight: '400',
    color: C.helper,
  },
  prompt: {
    fontSize: S.promptSize,
    lineHeight: S.promptLeading,
    fontWeight: '400',
    color: C.intro,
  },
  grid: {
    rowGap: S.pillGap,
  },
  gridRow: {
    flexDirection: 'row',
    columnGap: S.pillGap,
  },
  arrow: {
    fontWeight: '500',
    color: ElseaWelcomeColor.ctaLabel,
  },
});
