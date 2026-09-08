import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ElseaChoiceCard } from '@/components/elsea/elsea-choice-card';
import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import { TRANSITION_LABEL, TodayCopy } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import { track } from '@/lib/analytics';
import { selectSession } from '@/lib/catalogue';
import { bandFor, loadPatterns } from '@/lib/patterns';
import { navigateTo, replaceWith } from '@/navigation/elsea-routes';
import { useAuth } from '@/state/auth';
import { useSessionFlow } from '@/state/session-flow';
import type { RunHistoryEntry } from '@/lib/runs';
import type { DurationChoice } from '@/types/elsea';

const C = ElseaS02Color;

/** The person already had this length and said it worked; keep it. */
function choiceForRun(run: RunHistoryEntry): DurationChoice {
  const band = bandFor(run.durationSeconds);
  return band === 'under_5' ? 'short' : band === 'five_to_ten' ? 'medium' : 'long';
}

/**
 * SCREEN 17 — QUICK RETURN.
 *
 * Repeats something that already worked, without going back through describing
 * it. The list is the person's own history — sessions they rated `yes` — and
 * is empty when they have none. Nothing here is fabricated.
 *
 * No free text is entered on this screen, so there is nothing for the safety
 * gate to read and nothing to bypass: the transition being repeated was
 * already gated when it was first arrived at. Anyone wanting to describe
 * something new goes through Screen 02, and through the gate, as usual.
 */
export default function QuickReturnScreen() {
  const { userId } = useAuth();
  const { setInterpretation, setDurationChoice, setSelectedSession, setFailure } = useSessionFlow();

  const [options, setOptions] = useState<RunHistoryEntry[]>([]);
  const [chosen, setChosen] = useState<RunHistoryEntry | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    void loadPatterns(userId).then((patterns) => {
      if (!active) return;
      // One entry: the most recent thing they said worked. Offering five ways
      // to repeat the same transition would be a list, not a shortcut.
      const positive = patterns.mostRecentPositive ? [patterns.mostRecentPositive] : [];
      setOptions(positive);
      setChosen(patterns.mostRecentPositive);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const repeat = async () => {
    if (!chosen || working) return;
    setWorking(true);

    const choice = choiceForRun(chosen);
    const result = await selectSession(chosen.transitionKey, choice);

    if (!result.ok) {
      setFailure(result.failure === 'network' ? 'network' : 'selection');
      setWorking(false);
      replaceWith('error');
      return;
    }

    setInterpretation({
      transitionKey: chosen.transitionKey,
      sessionId: result.session.id,
      durationSeconds: result.session.durationSeconds,
      // The states are not re-derived: this is a repeat of a transition, and
      // the pair behind it is whatever it was. They are left null-ish here and
      // the run records the transition, which is the thing being repeated.
      stateCurrent: 'neutral',
      stateTarget: 'settled',
      contextTag: null,
      origin: 'quick_return',
    });
    setDurationChoice(choice);
    setSelectedSession(result.session);

    track({ name: 'quick_return_started', transition: chosen.transitionKey });
    setWorking(false);
    navigateTo('audioPrep');
  };

  return (
    <ElseaScreen
      screen="quick_return"
      onBack={goBack}
      heading={TodayCopy.quickReturnPrompt}
      action={
        options.length > 0 ? (
          <View>
            <ElseaFlowAction
              label={TodayCopy.primaryAction}
              onPress={() => void repeat()}
              disabled={!chosen || working}
            />
            <View style={styles.alternative}>
              <ElseaTextAction
                label="Something else is going on"
                onPress={() => navigateTo('situation')}
              />
            </View>
          </View>
        ) : (
          <ElseaFlowAction
            label={TodayCopy.primaryAction}
            onPress={() => navigateTo('situation')}
          />
        )
      }>
      {options.length === 0 ? (
        <Text style={styles.empty} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
          {TodayCopy.emptyRecent}
        </Text>
      ) : (
        <View style={styles.list} accessibilityRole="radiogroup">
          {options.map((option) => (
            <ElseaChoiceCard
              key={option.runId}
              title={TRANSITION_LABEL[option.transitionKey]}
              detail={`${Math.round(option.durationSeconds / 60)} minutes`}
              selected={chosen?.runId === option.runId}
              onPress={() => setChosen(option)}
            />
          ))}
        </View>
      )}
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 26,
    gap: 10,
  },
  empty: {
    marginTop: 26,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: C.prompt,
  },
  alternative: {
    marginTop: 8,
  },
});
