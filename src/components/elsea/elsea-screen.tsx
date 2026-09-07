import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { ElseaBackButton } from '@/components/elsea/elsea-back-button';
import { ElseaConversationField } from '@/components/elsea/elsea-conversation-field';
import { ElseaHeading } from '@/components/elsea/elsea-heading';
import { ElseaFontScaleCap, ElseaMotion, ElseaS02, ElseaS02Color } from '@/constants/elsea';
import { useElseaLayout } from '@/layout/use-elsea-layout';
import { trackScreen, type ScreenId } from '@/lib/analytics';

const C = ElseaS02Color;

type Props = {
  /** Analytics identifier. Recording the view is handled here, once. */
  screen: ScreenId;
  /** Omit for screens with no way back (the first screen of a flow). */
  onBack?: () => void;
  heading?: string;
  /** Supporting line beneath the heading. */
  supporting?: string;
  /** The bottom action region. Stays anchored; never scrolls away. */
  action?: ReactNode;
  /** Set for immersive screens: no heading chrome, content centred. */
  immersive?: boolean;
  children?: ReactNode;
};

/**
 * The shared screen shell.
 *
 * Everything the ELSEA flow renders sits in this: the field, the safe areas,
 * the responsive gutter and content cap, the back control, the responsive
 * heading, and a bottom action region that stays put. Screens supply their
 * own middle and nothing else, which is what stops twenty screens becoming
 * twenty slightly different layouts.
 *
 * Content is in normal flow inside a ScrollView whose container grows to fill
 * — so it behaves as a flex column when everything fits and reflows rather
 * than clipping when an accessibility text size means it does not.
 */
export function ElseaScreen({
  screen,
  onBack,
  heading,
  supporting,
  action,
  immersive = false,
  children,
}: Props) {
  const { insets, horizontalGutter, contentMaxWidth } = useElseaLayout();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    trackScreen(screen);
  }, [screen]);

  const settle = reduceMotion
    ? FadeIn.duration(ElseaMotion.contentDuration).delay(ElseaMotion.contentDelay)
    : FadeInDown.duration(ElseaMotion.contentDuration)
        .delay(ElseaMotion.contentDelay)
        .withInitialValues({ transform: [{ translateY: ElseaMotion.contentTravel }] });

  const actionSettle = FadeIn.duration(ElseaMotion.contentDuration).delay(
    ElseaMotion.contentDelay + 90
  );

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

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        // Always scrollable. With `flexGrow: 1` on the container a ScrollView
        // does not scroll while the content fits, so this costs nothing on the
        // short screens and is the only thing making the long ones reachable —
        // correction has nine state cards with a second list beneath them.
        bounces={false}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={settle}
          style={[
            column,
            { paddingTop: insets.top + ElseaS02.backTop },
            immersive && styles.immersive,
          ]}>
          {onBack ? <ElseaBackButton onPress={onBack} /> : null}

          {heading ? (
            <ElseaHeading style={onBack ? styles.headingUnderBack : undefined}>
              {heading}
            </ElseaHeading>
          ) : null}

          {supporting ? (
            <Text style={styles.supporting} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
              {supporting}
            </Text>
          ) : null}

          {children}
        </Animated.View>

        {/* Flexible space, so the action region sits at the bottom without a
            hardcoded margin doing the work. */}
        <View style={styles.spacer} />
      </ScrollView>

      {action ? (
        <Animated.View
          entering={actionSettle}
          style={[column, { paddingBottom: insets.bottom + ElseaS02.ctaBottom }]}>
          {action}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Sends the person back, or to the arrival screen if there is no history. */
export function goBack(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
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
    flexGrow: 1,
  },
  spacer: {
    flexGrow: 1,
    flexShrink: 1,
  },
  immersive: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  headingUnderBack: {
    marginTop: 12,
  },
  supporting: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: C.prompt,
  },
});
