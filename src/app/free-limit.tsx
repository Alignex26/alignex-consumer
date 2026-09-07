import { StyleSheet, Text, View } from 'react-native';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import { AccountCopy } from '@/constants/copy';
import { ElseaFontScaleCap } from '@/constants/elsea';
import { navigateTo, replaceWith } from '@/navigation/elsea-routes';

/**
 * SCREEN 24 — FREE LIMIT REACHED.
 *
 * The state and the route exist; nothing reaches them in normal use.
 *
 * PRODUCT DECISION REQUIRED — the free allowance is undecided, so
 * `ENTITLEMENT_ENFORCED` in `@/lib/entitlement` is false and this screen is
 * unreachable. It is driven from that boundary rather than from a counter kept
 * on the client, so that when a real entitlement provider is wired in, the
 * trigger moves with it and this screen does not have to change.
 */
export default function FreeLimitScreen() {
  return (
    <ElseaScreen
      screen="free_limit"
      onBack={goBack}
      heading={AccountCopy.freeLimitHeading}
      action={
        <View>
          <ElseaFlowAction label="See options" onPress={() => navigateTo('paywall')} />
          <View style={styles.secondary}>
            <ElseaTextAction label="Not now" onPress={() => replaceWith('today')} />
          </View>
        </View>
      }>
      <View style={styles.notice}>
        <Text style={styles.noticeText} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
          PRODUCT DECISION REQUIRED — no free allowance has been agreed, so
          nothing enforces this state.
        </Text>
      </View>
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginTop: 28,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 102, 0.55)',
    backgroundColor: 'rgba(255, 214, 102, 0.12)',
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: '#FFD666',
  },
  secondary: {
    marginTop: 8,
  },
});
