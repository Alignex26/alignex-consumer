import { View } from 'react-native';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen } from '@/components/elsea/elsea-screen';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import { ErrorCopy } from '@/constants/copy';
import { replaceWith } from '@/navigation/elsea-routes';
import { useSessionFlow } from '@/state/session-flow';

/**
 * SCREEN 25 — SOMETHING WENT WRONG.
 *
 * One calm treatment for every failure. The kinds are kept apart internally —
 * `ElseaFailure` distinguishes network, safety, interpretation, selection,
 * audio and persistence — so the product can behave correctly, but none of that
 * reaches the screen: no stack trace, no HTTP status, no provider name, no
 * Supabase message, and never a safety classification.
 *
 * "Try again" returns to Screen 02 rather than retrying in place, because every
 * failure that lands here happened partway through an attempt and the honest
 * thing is to start that attempt again — through the safety gate, as always.
 */
export default function ErrorScreen() {
  const { setFailure, reset } = useSessionFlow();

  const retry = () => {
    setFailure(null);
    reset();
    replaceWith('situation');
  };

  return (
    <ElseaScreen
      screen="error"
      heading={ErrorCopy.heading}
      supporting={ErrorCopy.supporting}
      action={
        <View>
          <ElseaFlowAction label={ErrorCopy.retry} onPress={retry} />
          <View style={{ marginTop: 8 }}>
            <ElseaTextAction label={ErrorCopy.back} onPress={() => replaceWith('arrival')} />
          </View>
        </View>
      }
    />
  );
}
