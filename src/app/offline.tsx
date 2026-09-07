import { View } from 'react-native';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen } from '@/components/elsea/elsea-screen';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import { ErrorCopy } from '@/constants/copy';
import { replaceWith } from '@/navigation/elsea-routes';

/**
 * SCREEN 26 — OFFLINE.
 *
 * ELSEA genuinely needs a connection: the safety gate is server-side and
 * unskippable, and session audio streams from storage. So this says the
 * operation needs a connection, and does not pretend anything works offline.
 *
 * No network-state library was installed for this. `expo-network` and
 * `@react-native-community/netinfo` would both be new dependencies for
 * something request failure already tells us — the flow reaches this screen
 * when a call fails, which is the moment that actually matters.
 */
export default function OfflineScreen() {
  return (
    <ElseaScreen
      screen="offline"
      heading={ErrorCopy.offlineHeading}
      supporting={ErrorCopy.offlineSupporting}
      action={
        <View>
          <ElseaFlowAction label={ErrorCopy.retry} onPress={() => replaceWith('situation')} />
          <View style={{ marginTop: 8 }}>
            <ElseaTextAction label={ErrorCopy.back} onPress={() => replaceWith('arrival')} />
          </View>
        </View>
      }
    />
  );
}
