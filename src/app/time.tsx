import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { ElseaPrimaryAction } from '@/components/elsea/elsea-primary-action';
import { ElseaRampText } from '@/components/elsea/elsea-ramp-text';
import { ElseaStateCard } from '@/components/elsea/elsea-state-card';
import { ElseaTimeChip } from '@/components/elsea/elsea-time-chip';
import { PRODUCT_NAME, TRADEMARK } from '@/constants/brand';
import {
  ELSEA_BRAND_RIGHT,
  ElseaFontScaleCap,
  ElseaTarget,
  ElseaTargetCompact,
  ElseaTargetSpace,
  ElseaTargetType,
  ElseaWelcomeColor,
} from '@/constants/elsea';
import { useElseaLayout } from '@/layout/use-elsea-layout';
import { track, trackScreen } from '@/lib/analytics';
import { selectSession } from '@/lib/catalogue';
import { ELSEA_TARGET_CARDS, cardForTarget, transitionForCard } from '@/lib/target-cards';
import { navigateTo, replaceWith } from '@/navigation/elsea-routes';
import { useSessionFlow } from '@/state/session-flow';
import { isTransitionKey, type DurationChoice } from '@/types/elsea';

const C = ElseaWelcomeColor;
const T = ElseaTarget;

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/** Shared with Screen 1, so the two screens sit on the same ground. */
const ground: ViewStyle = {
  ...FILL,
  backgroundColor: C.base,
  experimental_backgroundImage: [
    {
      type: 'linear-gradient' as const,
      direction: '180deg',
      colorStops: [
        { color: C.groundTop, positions: ['0%'] },
        { color: C.groundMid, positions: ['40%'] },
        { color: C.groundLow, positions: ['78%'] },
        { color: C.groundMid, positions: ['100%'] },
      ],
    },
  ],
};

/**
 * The four approved display options, and the engine input each resolves to.
 *
 * The engine's contract is a `DurationChoice` band, not a number of minutes,
 * and `selectSession` returns the longest catalogue session that fits the
 * band. Measured against the live catalogue:
 *
 *   5   -> short      300s
 *   10  -> medium     600s
 *   15  -> long       900s
 *   20+ -> extended  1200s
 *
 * Each is now a distinct exact value rather than a span, so the four selectors
 * can no longer collapse into one another. Where a family has no session of
 * the chosen length, selection falls to the nearest available, preferring the
 * shorter — see `selectSession`.
 */
const TIME_OPTIONS: {
  choice: DurationChoice | null;
  value: string;
  unit: string;
  label: string;
}[] = [
  { choice: 'short', value: '5', unit: 'minutes', label: '5 minutes' },
  { choice: 'medium', value: '10', unit: 'minutes', label: '10 minutes' },
  { choice: 'long', value: '15', unit: 'minutes', label: '15 minutes' },
  { choice: 'extended', value: '20+', unit: 'minutes', label: '20 or more minutes' },
];

/**
 * Real user-facing steps: describe the situation, choose target and time,
 * prepare the audio. The safety gate and interpretation sit between the first
 * two but are invisible processing, which section 4 excludes from the count.
 *
 * Three steps, and this is the second — which is what the reference showed all
 * along. It reads that way now because this screen absorbed the separate
 * confirm step; while that screen existed, the honest figure was 3 of 4.
 */
const FLOW_STEP = 2;
const FLOW_STEPS = 3;

/**
 * SCREEN 2 — TARGET STATE + AVAILABLE TIME.
 *
 * Occupies the existing `/time` route, so routing, guards and the next stage
 * are unchanged: interpretation still arrives with a canonical target, and
 * Next still selects from the approved catalogue and continues to audio prep.
 *
 * The target grid is an override, not a replacement. Interpretation's target
 * stays authoritative unless the person picks a card whose canonical mapping
 * is authorised — which today is FOCUSED alone. That is what keeps the golden
 * path intact while five of six mappings are undecided.
 */
export default function TargetAndTimeScreen() {
  const { insets, layoutClass, widthClass, horizontalGutter, contentMaxWidth } = useElseaLayout();
  const reduceMotion = useReducedMotion();
  const { interpretation, setInterpretation, setDurationChoice, setSelectedSession, setFailure } =
    useSessionFlow();

  const type = ElseaTargetType[widthClass];
  const space = ElseaTargetSpace[layoutClass];

  // A short screen caps the type rather than scaling it, so it steps once at
  // the boundary instead of drifting with viewport height.
  const compact = layoutClass === 'compact';
  const headingSize = compact
    ? Math.min(type.heading, ElseaTargetCompact.maxHeading)
    : type.heading;
  const supportSize = compact
    ? Math.min(type.support, ElseaTargetCompact.maxSupport)
    : type.support;
  const chipHeight = compact ? ElseaTargetCompact.chipHeight : ElseaTarget.chipHeight;
  const cardLabelSize = compact
    ? Math.min(type.cardLabel, ElseaTargetCompact.cardLabel)
    : type.cardLabel;
  const cardDetailSize = compact
    ? Math.min(type.cardDetail, ElseaTargetCompact.cardDetail)
    : type.cardDetail;
  const cardIconSize = compact ? ElseaTargetCompact.iconSize : ElseaTarget.iconSize;
  const cardInnerGap = compact ? ElseaTargetCompact.cardGap : 6;

  // The action region floats over the scroll view rather than shortening it,
  // so on a short screen the time selectors show through beneath it instead of
  // being cut off at an invisible boundary. Its height is needed twice: once
  // to lay it out, once as the scroll view's bottom inset so the last row can
  // still be scrolled fully clear of it.
  const actionTopPad = compact ? 8 : 12;
  const actionBottomPad = insets.bottom + (compact ? 10 : 16);
  const actionHeight = actionTopPad + ElseaTarget.ctaHeight + actionBottomPad;


  // Pre-select the card matching whatever was interpreted, where one exists.
  const [targetKey, setTargetKey] = useState<string | null>(
    () => cardForTarget(interpretation?.stateTarget ?? null)?.key ?? null
  );
  const [choice, setChoice] = useState<DurationChoice | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    trackScreen('time');
  }, []);

  // Guarded by hand rather than through `useFlowGuard`: this screen is also
  // reached from correction, whose interpretation carries no session yet.
  if (!interpretation) {
    replaceWith('situation');
    return null;
  }

  const onCard = (key: string) => {
    const card = ELSEA_TARGET_CARDS.find((c) => c.key === key);
    if (!card?.canonical) return;

    // The transition has to be recomputed, not just the target. Session
    // selection reads `transitionKey`, so setting `stateTarget` alone would
    // leave the two disagreeing and quietly discard the person's choice.
    const nextTransition = transitionForCard(interpretation.stateCurrent, card);
    if (!isTransitionKey(nextTransition)) return;

    setTargetKey(key);
    // Written straight into the canonical flow state — no parallel model.
    setInterpretation({
      ...interpretation,
      transitionKey: nextTransition,
      stateTarget: card.canonical,
      origin: 'corrected',
    });
  };

  const proceed = async () => {
    if (!choice || working) return;
    setWorking(true);

    // This screen is now where the interpretation is accepted, so the
    // confirmation is recorded here rather than on a separate screen.
    track({ name: 'interpretation_confirmed', transition: interpretation.transitionKey });
    track({ name: 'time_selected', choice });
    setDurationChoice(choice);

    const result = await selectSession(interpretation.transitionKey, choice);
    if (!result.ok) {
      setFailure(result.failure === 'network' ? 'network' : 'selection');
      setWorking(false);
      replaceWith('error');
      return;
    }

    setSelectedSession(result.session);
    track({
      name: 'session_selected',
      transition: interpretation.transitionKey,
      durationSeconds: result.session.durationSeconds,
    });

    setWorking(false);
    navigateTo('audioPrep');
  };

  const column = {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: horizontalGutter,
  } as const;

  const entrance = FadeIn.duration(reduceMotion ? 0 : 420).delay(reduceMotion ? 0 : 40);
  const rows = [ELSEA_TARGET_CARDS.slice(0, 3), ELSEA_TARGET_CARDS.slice(3, 6)];

  // A card is offered only when it maps to an approved target AND that target
  // forms an approved transition with this person's current state. Someone who
  // arrives wound up is offered Calmer and Rested; someone scattered is
  // offered Focused. Withholding the rest is what stops a choice leading to a
  // transition the catalogue has nothing for.
  const isAvailable = (card: (typeof ELSEA_TARGET_CARDS)[number]) =>
    isTransitionKey(transitionForCard(interpretation.stateCurrent, card));

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
            {
              paddingTop: insets.top + 10,
              // Room for the last row to scroll clear of the anchored action
              // region, rather than being cut by it.
              paddingBottom: actionHeight + (compact ? ElseaTargetCompact.scrollBottomPad : 14),
            },
          ]}>
          {/* Header. Brand left, brand language right. */}
          <View style={styles.header}>
            <View style={styles.brandLeft}>
              <View style={styles.markRow}>
                <Text
                  style={[
                    styles.mark,
                    { fontSize: type.wordmark, lineHeight: type.wordmark * 1.16 },
                  ]}
                  allowFontScaling={false}>
                  {PRODUCT_NAME}
                </Text>
                <Text
                  style={[styles.trademark, { fontSize: type.wordmark * 0.28 }]}
                  allowFontScaling={false}>
                  {TRADEMARK}
                </Text>
              </View>
              <Text
                style={[styles.tagline, { fontSize: type.tagline }]}
                maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
                A BRIGHTER YOU{'\n'}ON YOUR TERMS
              </Text>
            </View>

            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {ELSEA_BRAND_RIGHT.map((line) => (
                <Text key={line} style={[styles.brandRight, { fontSize: type.brandRight }]}>
                  {line}
                </Text>
              ))}
            </View>
          </View>

          {/* Progress. Derived from the real flow, not the artwork. */}
          <View style={[styles.progressRow, { marginTop: space.headerGap }]}>
            <View
              style={styles.progressTrack}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: FLOW_STEPS, now: FLOW_STEP }}>
              <View style={[styles.progressFill, { width: `${(FLOW_STEP / FLOW_STEPS) * 100}%` }]} />
            </View>
            <Text style={styles.stepLabel}>
              STEP {FLOW_STEP} OF {FLOW_STEPS}
            </Text>
          </View>

          {/* Heading. */}
          <View
            style={{ marginTop: space.progressGap }}
            accessible
            accessibilityRole="header"
            accessibilityLabel="How do you need to feel?">
            <Text
              style={[styles.heading, { fontSize: headingSize, lineHeight: headingSize * 1.14 }]}
              maxFontSizeMultiplier={ElseaFontScaleCap.headline}>
              How do you need
            </Text>
            <ElseaRampText
              colors={[C.softPink, C.lavender, C.electricBlue]}
              style={[styles.heading, { fontSize: headingSize, lineHeight: headingSize * 1.14 }]}
              maxFontSizeMultiplier={ElseaFontScaleCap.headline}>
              to feel?
            </ElseaRampText>
          </View>

          <Text
            style={[
              styles.support,
              { fontSize: supportSize, lineHeight: supportSize * 1.45, marginTop: space.supportGap },
            ]}
            maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
            Choose the state you’d like to move towards.{'\n'}It’s your moment.
          </Text>

          {/* Target grid, 3 x 2. */}
          <View
            style={{ marginTop: space.headingGap, gap: space.cardGap }}
            accessibilityRole="radiogroup">
            {rows.map((row, i) => (
              <View key={i} style={[styles.gridRow, { gap: space.cardGap }]}>
                {row.map((card) => (
                  <ElseaStateCard
                    key={card.key}
                    label={card.label}
                    detail={card.detail}
                    symbol={card.symbol}
                    selected={targetKey === card.key}
                    available={isAvailable(card)}
                    labelSize={cardLabelSize}
                    detailSize={cardDetailSize}
                    iconSize={cardIconSize}
                    innerGap={cardInnerGap}
                    minHeight={space.cardMinHeight}
                    paddingVertical={space.cardPadY}
                    onPress={() => onCard(card.key)}
                  />
                ))}
              </View>
            ))}
          </View>

          {/* Time. */}
          <Text style={[styles.timeHeading, { marginTop: space.gridGap }]}>
            HOW MUCH TIME DO YOU HAVE?
          </Text>
          <View
            style={[styles.timeRow, { marginTop: space.timeGap, gap: space.chipGap }]}
            accessibilityRole="radiogroup">
            {TIME_OPTIONS.map((option) => (
              <ElseaTimeChip
                key={option.value}
                value={option.value}
                unit={option.unit}
                selected={option.choice !== null && choice === option.choice}
                available={option.choice !== null}
                accessibilityLabel={option.label}
                height={chipHeight}
                valueSize={type.timeValue}
                unitSize={type.timeUnit}
                onPress={() => option.choice && setChoice(option.choice)}
              />
            ))}
          </View>
        </Animated.View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* CTA. Floats over the scroll view; never scrolls away. The fade above
          it dissolves whatever is underneath, so a partly visible row reads as
          "there is more here" rather than as a clipped element. */}
      <View style={styles.actionLayer} pointerEvents="box-none">
        <View style={[styles.actionFade, { bottom: actionHeight }]} pointerEvents="none" />
        <View
          style={[
            column,
            styles.actionBlock,
            { paddingTop: actionTopPad, paddingBottom: actionBottomPad },
          ]}>
          <ElseaPrimaryAction
            label="Next"
            accessibilityHint="Finds a session for the time you have."
            tone="welcome"
            height={T.ctaHeight}
            borderRadius={T.ctaRadius}
            fontSize={T.ctaTextSize}
            lineHeight={T.ctaTextSize * 1.2}
            elevated={false}
            disabled={!choice || working}
            onPress={() => void proceed()}
            trailing={<Text style={[styles.arrow, { fontSize: T.ctaTextSize }]}>→</Text>}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  spacer: { flexGrow: 1 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandLeft: { flexShrink: 1 },
  markRow: { alignSelf: 'flex-start' },
  mark: {
    fontWeight: '200',
    letterSpacing: T.brandTracking,
    color: C.offWhite,
  },
  trademark: {
    position: 'absolute',
    right: -12,
    top: 2,
    fontWeight: '400',
    color: C.muted,
  },
  tagline: {
    marginTop: 8,
    fontWeight: '400',
    letterSpacing: T.taglineTracking,
    lineHeight: 15,
    color: C.paleLilac,
    opacity: 0.7,
  },
  brandRight: {
    fontWeight: '500',
    letterSpacing: T.labelTracking,
    lineHeight: 15,
    textAlign: 'right',
    color: C.muted,
    opacity: 0.8,
  },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  progressTrack: {
    flex: 1,
    height: T.progressHeight,
    borderRadius: T.progressRadius,
    overflow: 'hidden',
    backgroundColor: T.progressTrack,
  },
  progressFill: {
    height: '100%',
    borderRadius: T.progressRadius,
    backgroundColor: '#B58AFF',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.8,
    color: C.muted,
  },

  heading: {
    fontWeight: '300',
    letterSpacing: -0.6,
    color: C.offWhite,
  },
  support: {
    fontWeight: '400',
    color: C.muted,
  },

  gridRow: { flexDirection: 'row' },

  timeHeading: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2.2,
    color: C.paleLilac,
    opacity: 0.85,
  },
  timeRow: { flexDirection: 'row' },

  actionLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  actionBlock: {
    backgroundColor: C.groundMid,
  },
  actionFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 26,
    experimental_backgroundImage: [
      {
        type: 'linear-gradient' as const,
        direction: '180deg',
        colorStops: [
          { color: 'rgba(12, 10, 36, 0)', positions: ['0%'] },
          { color: 'rgba(12, 10, 36, 0.86)', positions: ['62%'] },
          { color: C.groundMid, positions: ['100%'] },
        ],
      },
    ],
  },
  arrow: { fontWeight: '500', color: C.ctaLabel },
});
