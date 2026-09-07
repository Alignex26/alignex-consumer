import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { ElseaArrivalField } from '@/components/elsea/elsea-arrival-field';
import { ElseaPrimaryAction } from '@/components/elsea/elsea-primary-action';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import { ElseaWordmark } from '@/components/elsea/elsea-wordmark';
import { PRODUCT_NAME } from '@/constants/brand';
import {
  ElseaActionBottomMin,
  ElseaActionType,
  ElseaArrivalColor,
  ElseaArrivalHeadline,
  ElseaArrivalLayout,
  ElseaBreakpoint,
  ElseaFontScaleCap,
  ElseaMotion,
  ElseaRadius,
  withAlpha,
} from '@/constants/elsea';
import { useElseaLayout } from '@/layout/use-elsea-layout';
import { navigateTo } from '@/navigation/elsea-routes';

const C = ElseaArrivalColor;
const L = ElseaArrivalLayout;
const H = ElseaArrivalHeadline;

/**
 * SCREEN 01 — FIRST ARRIVAL
 *
 * Four conceptual regions, none of which is a visible container:
 *
 *   A  brand      — below the top safe area, centred
 *   B  message    — headline and supporting copy
 *   C  atmosphere — the flexible space above and below B
 *   D  action     — CTA and account link, anchored to the bottom
 *
 * Nothing here is positioned by screen coordinate. The headline lands near the
 * midpoint of the usable area on the canonical frame because the flexible
 * spaces either side of it are split 61/39, not because it is told to sit at
 * 420pt or at 49%. Shorter viewports therefore take space out of C above the
 * message before they take it from below — the ratio does that on its own.
 *
 * The upper three regions sit in a ScrollView so that an accessibility text
 * size which genuinely outgrows the viewport reflows instead of clipping. The
 * action region is outside it and stays attached to the bottom.
 */
export default function FirstArrivalScreen() {
  const { insets, layoutClass, widthClass, horizontalGutter, contentMaxWidth } = useElseaLayout();
  const { fontScale } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const bp = ElseaBreakpoint[layoutClass];
  // Width, not height, decides the headline: what matters is whether the first
  // sentence has room to stay on one line.
  const headline = H[widthClass];

  const onTellUs = useCallback(() => navigateTo('situation'), []);
  const onSignIn = useCallback(() => navigateTo('signIn'), []);

  // RN scales fontSize with the system font scale but leaves lineHeight alone,
  // so explicit leading has to be scaled by hand or long copy collides.
  const headlineScale = Math.min(fontScale, ElseaFontScaleCap.headline);
  const supportingScale = Math.min(fontScale, ElseaFontScaleCap.supporting);

  const brandEntering = FadeIn.duration(ElseaMotion.brandDuration).delay(ElseaMotion.brandDelay);

  // Reduce Motion drops the vertical settle and arrives on opacity alone.
  const heroEntering = reduceMotion
    ? FadeIn.duration(ElseaMotion.heroDuration).delay(ElseaMotion.heroDelay)
    : FadeInDown.duration(ElseaMotion.heroDuration)
        .delay(ElseaMotion.heroDelay)
        .withInitialValues({ transform: [{ translateY: ElseaMotion.heroTravel }] });

  const actionsEntering = FadeIn.duration(ElseaMotion.actionsDuration).delay(
    ElseaMotion.actionsDelay
  );

  const column = {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: horizontalGutter,
  } as const;

  return (
    <View style={styles.root}>
      <ElseaArrivalField />
      <StatusBar style="light" />

      <View style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}>
          {/* A — brand */}
          <Animated.View
            entering={brandEntering}
            style={[column, styles.brand, { marginTop: insets.top + bp.brandMarginTop }]}>
            <ElseaWordmark />
          </Animated.View>

          {/* C — flexible space above the message */}
          <View style={{ flexGrow: L.spaceAboveMessage, flexShrink: 1 }} />

          {/* B — message */}
          <Animated.View entering={heroEntering} style={column}>
            {/*
              Two separate Text nodes, not one string with a newline in it. The
              composition is two locked lines, and a newline would still let
              "Change how you feel." break internally on a narrow width and turn
              the headline into three ragged lines. As separate nodes each
              sentence is measured on its own, so the break between them is the
              only one that can happen at standard and wide widths.

              Grouped for assistive technology so it is announced as one heading.
            */}
            <View accessible accessibilityRole="header">
              <Text
                style={[
                  styles.headline,
                  { fontSize: headline.size, lineHeight: headline.leading * headlineScale },
                ]}
                maxFontSizeMultiplier={ElseaFontScaleCap.headline}>
                Change how you feel.
              </Text>
              <Text
                style={[
                  styles.headline,
                  { fontSize: headline.size, lineHeight: headline.leading * headlineScale },
                ]}
                maxFontSizeMultiplier={ElseaFontScaleCap.headline}>
                Not who you are.
              </Text>
            </View>
            <Text
              style={[
                styles.supporting,
                {
                  marginTop: bp.headlineToSupporting,
                  marginRight: L.supportingRightInset,
                  fontSize: bp.supportingSize,
                  lineHeight: bp.supportingLeading * supportingScale,
                },
              ]}
              maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
              Tell {PRODUCT_NAME} what’s going on.{'\n'}We’ll help you get ready for what comes next.
            </Text>
          </Animated.View>

          {/* C — flexible space below the message */}
          <View
            style={{
              flexGrow: L.spaceBelowMessage,
              flexShrink: 1,
              minHeight: L.minSpaceBelowMessage,
            }}
          />
        </ScrollView>

        {/* D — action region. One block; the two controls belong together. */}
        <Animated.View
          entering={actionsEntering}
          style={[
            column,
            { paddingBottom: Math.max(insets.bottom, ElseaActionBottomMin) },
          ]}>
          <ElseaPrimaryAction
            label="Tell me what’s going on"
            accessibilityHint="Describe your situation in your own words"
            tone="lilac"
            height={bp.ctaHeight}
            borderRadius={ElseaRadius.action}
            fontSize={ElseaActionType.size}
            lineHeight={ElseaActionType.leading}
            elevated={false}
            onPress={onTellUs}
          />
          <View style={{ marginTop: bp.ctaToAccount }}>
            <ElseaTextAction label="I already have an account" onPress={onSignIn} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.baseBlackIndigo,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    // Behaves exactly like a flex column while the content fits, and becomes
    // scrollable only when an accessibility text size makes it overflow.
    flexGrow: 1,
  },
  brand: {
    alignItems: 'center',
  },
  headline: {
    // Never truncated and never ellipsised: if a width genuinely cannot hold a
    // sentence it wraps, which is the last resort rather than the mechanism.
    flexShrink: 1,
    fontWeight: H.weight,
    letterSpacing: H.letterSpacing,
    color: H.color,
  },
  supporting: {
    fontWeight: '400',
    letterSpacing: 0,
    color: withAlpha(C.secondaryText, 0.86),
    maxWidth: 330,
  },
});
