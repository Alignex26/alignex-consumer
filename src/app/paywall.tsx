import { StyleSheet, Text, View } from 'react-native';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { AccountCopy } from '@/constants/copy';
import { ElseaFontScaleCap } from '@/constants/elsea';
import { track } from '@/lib/analytics';
import { useEffect } from 'react';

/**
 * SCREEN 23 — PAYWALL.
 *
 * The route and the integration boundary, with no commercial terms on it.
 *
 * CONFIGURATION REQUIRED — RevenueCat is not installed or configured.
 * PRODUCT DECISION REQUIRED — PRICING
 * PRODUCT DECISION REQUIRED — TRIAL
 * PRODUCT DECISION REQUIRED — FREE ALLOWANCE
 *
 * There is deliberately no price, no trial length, no plan comparison and no
 * purchase button here. A screen that showed an invented price would be the
 * single easiest thing in this build to mistake for a decision that had been
 * made, so it shows none — and says so, in development, where it is visible.
 */
export default function PaywallScreen() {
  useEffect(() => {
    track({ name: 'paywall_viewed' });
  }, []);

  return (
    <ElseaScreen
      screen="paywall"
      onBack={goBack}
      heading={AccountCopy.paywallHeading}
      action={<ElseaFlowAction label="Go back" onPress={goBack} />}>
      <View style={styles.notice}>
        <Text style={styles.noticeText} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
          PRODUCT DECISION REQUIRED — pricing, trial and free allowance are
          undecided, and no purchase provider is configured.
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
});
