import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ElseaChoiceCard } from '@/components/elsea/elsea-choice-card';
import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { DURATION_LABEL, TimeCopy } from '@/constants/copy';
import { track } from '@/lib/analytics';
import { selectSession } from '@/lib/catalogue';
import { navigateTo, replaceWith } from '@/navigation/elsea-routes';
import { useAuth } from '@/state/auth';
import { useSessionFlow } from '@/state/session-flow';
import { DURATION_CHOICES, type DurationChoice } from '@/types/elsea';

/**
 * SCREEN 06 — HOW MUCH TIME?
 *
 * Time is a first-class input, not a setting. Four approved choices, stacked
 * as cards; no slider, no minute entry.
 *
 * Pressing the action does the actual catalogue selection before moving on, so
 * the person never reaches the audio-prep screen only to find there is nothing
 * to play. The button is disabled while that is happening — a second press
 * cannot start a second selection.
 */
export default function TimeScreen() {
  const { interpretation, setDurationChoice, setSelectedSession, setFailure } = useSessionFlow();
  const { userId } = useAuth();

  const [choice, setChoice] = useState<DurationChoice | null>(null);
  const [working, setWorking] = useState(false);

  // Guarded by hand rather than through `useFlowGuard`: this screen is
  // reachable from correction, where the interpretation is a corrected one
  // that has no session on it yet.
  if (!interpretation) {
    replaceWith('situation');
    return null;
  }

  const find = async () => {
    if (!choice || working) return;
    setWorking(true);

    track({ name: 'time_selected', choice });
    setDurationChoice(choice);

    const result = await selectSession(interpretation.transitionKey, choice, userId);

    if (!result.ok) {
      // No eligible session is an explicit outcome, never a silently invented
      // one. Each failure kind is kept apart internally; the error screen
      // shows the same calm message for all of them.
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

  return (
    <ElseaScreen
      screen="time"
      onBack={goBack}
      heading={TimeCopy.heading}
      action={
        <ElseaFlowAction
          label={TimeCopy.primaryAction}
          onPress={find}
          disabled={!choice || working}
        />
      }>
      <View style={styles.list} accessibilityRole="radiogroup">
        {DURATION_CHOICES.map((option) => (
          <ElseaChoiceCard
            key={option}
            title={DURATION_LABEL[option].title}
            detail={DURATION_LABEL[option].detail}
            selected={choice === option}
            onPress={() => setChoice(option)}
          />
        ))}
      </View>
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 26,
    gap: 10,
  },
});
