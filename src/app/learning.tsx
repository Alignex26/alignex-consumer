import { useEffect } from 'react';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen } from '@/components/elsea/elsea-screen';
import { LearningCopy } from '@/constants/copy';
import { track } from '@/lib/analytics';
import { replaceWith } from '@/navigation/elsea-routes';
import { useSessionDraft } from '@/state/session-draft';
import { useSessionFlow } from '@/state/session-flow';

/**
 * SCREEN 15 — LEARNING.
 *
 * Closes the loop: what you just told us changes what we choose next time.
 *
 * The wording is deliberately conservative. It does not claim to know what
 * works for you after one session, and it does not imply anything clinical —
 * "it takes a few sessions before that means much" is doing real work there,
 * because it is true and because overclaiming here would be the easiest way to
 * make the product dishonest.
 *
 * This is the end of the attempt, so both the person's words and the flow
 * state are cleared on the way out to Today.
 */
export default function LearningScreen() {
  const { reset } = useSessionFlow();
  const { clearSituationText, setShortcut } = useSessionDraft();

  useEffect(() => {
    track({ name: 'learning_screen_viewed' });
  }, []);

  const done = () => {
    clearSituationText();
    setShortcut(null);
    reset();
    replaceWith('today');
  };

  return (
    <ElseaScreen
      screen="learning"
      heading={LearningCopy.heading}
      supporting={LearningCopy.supporting}
      action={<ElseaFlowAction label={LearningCopy.primaryAction} onPress={done} />}
    />
  );
}
