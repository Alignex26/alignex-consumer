import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen } from '@/components/elsea/elsea-screen';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import { TRANSITION_LABEL, TodayCopy } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import { loadPatterns, type Patterns } from '@/lib/patterns';
import { navigateTo } from '@/navigation/elsea-routes';
import { useAuth } from '@/state/auth';
import { useSessionDraft } from '@/state/session-draft';
import { useSessionFlow } from '@/state/session-flow';

const C = ElseaS02Color;

/**
 * SCREEN 16 — TODAY.
 *
 * The centre of gravity once someone has been through the flow once, and
 * emphatically not a dashboard. The fastest route into a new transition is the
 * biggest thing on the screen; everything else is one quiet line.
 *
 * What is deliberately absent: charts, scores, streaks, a content feed,
 * recommended reading, courses, community. None of those are this product.
 *
 * The one piece of history shown is the last thing that actually happened. If
 * there is nothing, it says so rather than inventing something to fill space.
 */
export default function TodayScreen() {
  const { userId } = useAuth();
  const { reset } = useSessionFlow();
  const { clearSituationText, setShortcut } = useSessionDraft();

  const [patterns, setPatterns] = useState<Patterns | null>(null);

  useEffect(() => {
    let active = true;
    void loadPatterns(userId).then((next) => {
      if (active) setPatterns(next);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const startFresh = () => {
    // Anything left over from a previous attempt goes, so nobody starts a new
    // session with their last one's words still in the box.
    clearSituationText();
    setShortcut(null);
    reset();
    navigateTo('situation');
  };

  const recent = patterns?.mostRecent ?? null;

  return (
    <ElseaScreen
      screen="today"
      heading={TodayCopy.heading}
      action={<ElseaFlowAction label={TodayCopy.primaryAction} onPress={startFresh} />}>
      <View style={styles.recent}>
        <Text style={styles.label} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
          {TodayCopy.recentLabel}
        </Text>

        {recent ? (
          <>
            <Text style={styles.value} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
              {TRANSITION_LABEL[recent.transitionKey]}
            </Text>
            {patterns?.mostRecentPositive ? (
              <View style={styles.quick}>
                <ElseaTextAction
                  label={TodayCopy.quickReturnPrompt}
                  onPress={() => navigateTo('quickReturn')}
                  accessibilityHint="Repeats a session you said worked."
                />
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.empty} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
            {TodayCopy.emptyRecent}
          </Text>
        )}
      </View>
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  recent: {
    marginTop: 32,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.prompt,
  },
  value: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: '#FAF8FC',
  },
  empty: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: C.prompt,
  },
  quick: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
});
