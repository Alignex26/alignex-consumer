import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { ElseaOrb } from '@/components/elsea/elsea-orb';
import { ElseaPrimaryAction } from '@/components/elsea/elsea-primary-action';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import { ElseaWordmark } from '@/components/elsea/elsea-wordmark';
import {
  ElseaFontScaleCap,
  ElseaWelcome,
  ElseaWelcomeColor,
  ElseaWelcomeCompact,
  ElseaWelcomeSpace,
  ElseaWelcomeType,
} from '@/constants/elsea';
import { useElseaLayout } from '@/layout/use-elsea-layout';
import { navigateTo } from '@/navigation/elsea-routes';

const C = ElseaWelcomeColor;
const W = ElseaWelcome;

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/**
 * The ground. Near-black indigo, deepening very slightly toward the lower
 * third so the orb has somewhere to sit.
 *
 * No bloom, no trails, no ambient violet wash. Whatever light this screen has
 * belongs to the orb and the CTA; the field itself stays quiet, which is what
 * lets 260-odd points of artwork read as luminous rather than as one bright
 * thing among several.
 */
const ground: ViewStyle = {
  ...FILL,
  backgroundColor: C.base,
  experimental_backgroundImage: [
    {
      type: 'linear-gradient' as const,
      direction: '180deg',
      colorStops: [
        { color: C.groundTop, positions: ['0%'] },
        { color: C.groundMid, positions: ['46%'] },
        { color: C.groundLow, positions: ['100%'] },
      ],
    },
  ],
};

/**
 * SCREEN 1 — WELCOME.
 *
 * The brand moment. Six things on the screen and a great deal of space:
 * wordmark, tagline, orb, the proposition, its supporting line, and the action
 * pair. Nothing else — no Skip, no settings, no cards, no borders, no second
 * illustration.
 *
 * The orb is deliberately smaller than the space it sits in. The room that
 * frees goes to the two flexible spaces either side of it, never to enlarging
 * anything else.
 *
 * The vertical composition is two flexible spaces either side of the orb. That
 * is what produces the negative space on a tall phone and, on a short one,
 * gives that space back before anything readable or tappable is touched — the
 * height classes only set the MINIMUM those spaces may collapse to.
 *
 * Routing is unchanged: the CTA goes to the situation screen, the account link
 * to sign-in.
 */
export default function WelcomeScreen() {
  const { insets, layoutClass, widthClass, horizontalGutter, contentMaxWidth } = useElseaLayout();
  const reduceMotion = useReducedMotion();

  const type = ElseaWelcomeType[widthClass];
  const space = ElseaWelcomeSpace[layoutClass];

  // A short screen caps the type rather than scaling it, so it steps once at
  // the boundary instead of drifting with viewport height.
  const compact = layoutClass === 'compact';
  const headlineSize = compact
    ? Math.min(type.headline, ElseaWelcomeCompact.maxHeadline)
    : type.headline;
  const supportSize = compact
    ? Math.min(type.support, ElseaWelcomeCompact.maxSupport)
    : type.support;

  const onStart = useCallback(() => navigateTo('situation'), []);
  const onSignIn = useCallback(() => navigateTo('signIn'), []);

  // A single soft entrance. Nothing repeats, nothing bounces, nothing pulses.
  const entrance = FadeIn.duration(reduceMotion ? 0 : 620).delay(reduceMotion ? 0 : 60);

  const column = {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: horizontalGutter,
  } as const;

  return (
    <View style={styles.root}>
      <View style={ground} pointerEvents="none" />
      <StatusBar style="light" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        bounces={false}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={entrance}
          style={[
            column,
            styles.body,
            {
              paddingTop: insets.top + space.brandTop,
              paddingBottom: insets.bottom + 12,
            },
          ]}>
          {/* Brand. */}
          <ElseaWordmark width={type.wordmark} />

          <Text
            style={[styles.tagline, { fontSize: type.tagline, marginTop: space.taglineTop }]}
            maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
            A BRIGHTER YOU{'\n'}ON YOUR TERMS
          </Text>

          {/* Negative space. Collapses to its minimum before the orb shrinks. */}
          <View style={[styles.space, { minHeight: space.orbGap }]} />

          <ElseaOrb size={type.orb * space.orbScale} />

          <View style={[styles.space, { minHeight: space.messageGap }]} />

          {/* The proposition. Two lines, set light, in one colour — no ramp
              on any word and no glow, so the orb keeps the only light. */}
          <Text
            style={[
              styles.headline,
              { fontSize: headlineSize, lineHeight: headlineSize * 1.22 },
            ]}
            accessibilityRole="header"
            maxFontSizeMultiplier={ElseaFontScaleCap.headline}>
            Don’t take it{'\n'}with you.
          </Text>

          <Text
            style={[
              styles.support,
              {
                fontSize: supportSize,
                lineHeight: supportSize * 1.5,
                marginTop: space.supportTop,
              },
            ]}
            maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
            How you feel now doesn’t have{'\n'}to decide how you feel next.
          </Text>

          <View style={{ height: space.ctaGap }} />

          <View style={styles.ctaBlock}>
            <ElseaPrimaryAction
              label="Make the shift"
              accessibilityHint="Describe what’s going on and get a session."
              tone="welcome"
              height={W.ctaHeight}
              borderRadius={W.ctaRadius}
              fontSize={type.cta}
              lineHeight={type.cta * 1.2}
              elevated={false}
              glowColor={C.lavender}
              onPress={onStart}
              trailing={<Text style={[styles.arrow, { fontSize: type.cta }]}>→</Text>}
            />

            <View style={{ marginTop: space.accountTop }}>
              <ElseaTextAction label="I already have an account" onPress={onSignIn} />
            </View>
          </View>
        </Animated.View>
      </ScrollView>
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
  scroll: {
    flexGrow: 1,
  },
  body: {
    flexGrow: 1,
    alignItems: 'center',
  },
  /**
   * The two flexible spaces. They grow to fill whatever height is left over
   * and shrink to `minHeight` when there is none, which is how a short screen
   * loses air rather than losing content.
   */
  space: {
    flexGrow: 1,
    flexShrink: 1,
    width: '100%',
  },
  tagline: {
    fontWeight: '400',
    letterSpacing: W.taglineTracking,
    lineHeight: 18,
    textAlign: 'center',
    color: C.paleLilac,
    opacity: 0.72,
  },
  /**
   * Light rather than bold. At this size the lighter weight is what makes the
   * proposition read as editorial rather than as app onboarding.
   */
  headline: {
    fontWeight: '200',
    letterSpacing: -0.4,
    textAlign: 'center',
    color: C.offWhite,
  },
  /** One weight throughout. No part of this sentence is emphasised. */
  support: {
    fontWeight: '300',
    textAlign: 'center',
    maxWidth: W.supportMaxWidth,
    color: C.muted,
  },
  ctaBlock: {
    width: '100%',
  },
  arrow: {
    fontWeight: '500',
    color: C.ctaLabel,
  },
});
