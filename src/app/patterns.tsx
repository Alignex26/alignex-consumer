import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { TRANSITION_LABEL, YouCopy } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import { loadPatterns, type DurationBand, type Patterns } from '@/lib/patterns';
import { useAuth } from '@/state/auth';

const C = ElseaS02Color;

const BAND_LABEL: Record<DurationBand, string> = {
  under_5: 'Under 5 minutes',
  five_to_ten: '5 to 10 minutes',
  over_ten: 'Over 10 minutes',
};

/**
 * SCREEN 19 — YOUR PATTERNS.
 *
 * Only what the person's own rows support, stated at the strength the data
 * actually justifies. Counts are counts. The duration section says how many
 * sessions of each length someone said helped, out of how many they rated —
 * with the denominator visible, because "8 of 11" is honest in a way that
 * "73%" is not at this sample size.
 *
 * Nothing here claims causation, diagnoses anything, or asserts statistical
 * significance. Below a handful of sessions it says there is not enough yet,
 * which is a real answer rather than an empty state to be filled.
 */
export default function PatternsScreen() {
  const { userId } = useAuth();
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadPatterns(userId).then((next) => {
      if (!active) return;
      setPatterns(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const enough = patterns?.hasEnoughData ?? false;

  return (
    <ElseaScreen screen="patterns" onBack={goBack} heading={YouCopy.patternsHeading}>
      {loading ? null : !enough ? (
        <Text style={styles.empty} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
          {YouCopy.patternsEmpty}
        </Text>
      ) : (
        <View style={styles.sections}>
          <View style={styles.section}>
            <Text style={styles.label}>Sessions</Text>
            <Text style={styles.value}>
              {patterns!.completedRuns} completed of {patterns!.totalRuns} started
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Transitions you use</Text>
            {patterns!.transitionCounts.map((row) => (
              <Text key={row.transition} style={styles.row}>
                {TRANSITION_LABEL[row.transition]} — {row.count}
              </Text>
            ))}
          </View>

          {patterns!.durationOutcomes.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.label}>Length you rate well</Text>
              {patterns!.durationOutcomes.map((row) => (
                <Text key={row.band} style={styles.row}>
                  {BAND_LABEL[row.band]} — helped {row.positive} of {row.total}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  empty: {
    marginTop: 26,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: C.prompt,
  },
  sections: {
    marginTop: 26,
    gap: 26,
  },
  section: {
    gap: 6,
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
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    color: '#FAF8FC',
  },
  row: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: '#FAF8FC',
  },
});
