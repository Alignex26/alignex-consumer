import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ElseaChoiceCard } from '@/components/elsea/elsea-choice-card';
import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen } from '@/components/elsea/elsea-screen';
import { OUTCOME_LABEL, OutcomeCopy } from '@/constants/copy';
import { useFlowGuard } from '@/flow/use-flow-guard';
import { track } from '@/lib/analytics';
import { recordOutcome } from '@/lib/runs';
import { navigateTo } from '@/navigation/elsea-routes';
import { useAuth } from '@/state/auth';
import { useSessionFlow } from '@/state/session-flow';
import { OUTCOMES, type Outcome } from '@/types/elsea';

/**
 * SCREEN 13 — DID WE GET YOU THERE?
 *
 * The measurement the whole product turns on: without it there is nothing to
 * learn from. Three controlled values, stored as codes — never as the label
 * that happens to be on screen today.
 *
 * Deliberately not here: a 1–10 scale, emoji faces, or any clinical measure.
 *
 * The write is best-effort. Someone who is signed out, or offline, still gets
 * through the flow; what they lose is the personalisation, not the session.
 */
export default function OutcomeScreen() {
  const ready = useFlowGuard('run');
  const { userId } = useAuth();
  const { run, interpretation, setOutcome } = useSessionFlow();

  const [choice, setChoice] = useState<Outcome | null>(null);
  const [saving, setSaving] = useState(false);

  if (!ready || !run) return null;

  const proceed = async () => {
    if (!choice || saving) return;
    setSaving(true);

    setOutcome(choice);
    await recordOutcome(run, choice, userId);

    if (interpretation) {
      track({
        name: 'outcome_recorded',
        transition: interpretation.transitionKey,
        outcome: choice,
      });
    }

    setSaving(false);
    navigateTo('outcomeDetail');
  };

  return (
    <ElseaScreen
      screen="outcome"
      heading={OutcomeCopy.heading}
      action={
        <ElseaFlowAction
          label={OutcomeCopy.primaryAction}
          onPress={() => void proceed()}
          disabled={!choice || saving}
        />
      }>
      <View style={styles.list} accessibilityRole="radiogroup">
        {OUTCOMES.map((option) => (
          <ElseaChoiceCard
            key={option}
            title={OUTCOME_LABEL[option]}
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
