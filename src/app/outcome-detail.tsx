import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ElseaChoiceCard } from '@/components/elsea/elsea-choice-card';
import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen } from '@/components/elsea/elsea-screen';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import {
  OUTCOME_DETAIL_CODES,
  OUTCOME_DETAIL_LABEL,
  OutcomeCopy,
  type OutcomeDetailCode,
} from '@/constants/copy';
import { useFlowGuard } from '@/flow/use-flow-guard';
import { recordOutcome } from '@/lib/runs';
import { navigateTo } from '@/navigation/elsea-routes';
import { useAuth } from '@/state/auth';
import { useSessionFlow } from '@/state/session-flow';

/**
 * SCREEN 14 — ONE MORE THING, OPTIONALLY.
 *
 * PRODUCT DECISION REQUIRED: which single extra signal is worth asking for has
 * not been decided. What is implemented is the structure — one question,
 * controlled answers, a real Skip — with session length standing in as the
 * question, because it is the one thing the selection logic could actually act
 * on today.
 *
 * This is not journaling and must not become it: there is no free-text field
 * on this screen, and the answer is stored as a code.
 */
export default function OutcomeDetailScreen() {
  const ready = useFlowGuard('run');
  const { userId } = useAuth();
  const { run, outcome } = useSessionFlow();

  const [choice, setChoice] = useState<OutcomeDetailCode | null>(null);
  const [saving, setSaving] = useState(false);

  if (!ready || !run) return null;

  const finish = async (code: OutcomeDetailCode | null) => {
    if (saving) return;
    setSaving(true);

    // Only ever an update to the row the previous screen wrote — the unique
    // constraint on `run_id` means this cannot create a second outcome.
    if (code && outcome) {
      await recordOutcome(run, outcome, userId, code);
    }

    setSaving(false);
    navigateTo('learning');
  };

  return (
    <ElseaScreen
      screen="outcome_detail"
      heading={OutcomeCopy.detailHeading}
      action={
        <View>
          <ElseaFlowAction
            label={OutcomeCopy.primaryAction}
            onPress={() => void finish(choice)}
            disabled={!choice || saving}
          />
          <View style={styles.skip}>
            <ElseaTextAction
              label={OutcomeCopy.detailSkip}
              onPress={() => void finish(null)}
              accessibilityHint="Continues without answering."
            />
          </View>
        </View>
      }>
      <View style={styles.list} accessibilityRole="radiogroup">
        {OUTCOME_DETAIL_CODES.map((code) => (
          <ElseaChoiceCard
            key={code}
            title={OUTCOME_DETAIL_LABEL[code]}
            selected={choice === code}
            onPress={() => setChoice(code)}
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
  skip: {
    marginTop: 8,
  },
});
