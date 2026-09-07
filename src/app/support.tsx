import { StyleSheet, Text, View } from 'react-native';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen } from '@/components/elsea/elsea-screen';
import { SupportCopy } from '@/constants/copy';
import { ElseaFontScaleCap } from '@/constants/elsea';
import { replaceWith } from '@/navigation/elsea-routes';
import { useSessionDraft } from '@/state/session-draft';
import { useSessionFlow } from '@/state/session-flow';

/**
 * SAFETY DIVERSION.
 *
 * Reached when the server-side gate flags the input, or when the gate itself
 * could not be completed. Those two cases are deliberately identical from
 * here: nothing on this screen can tell which happened, and nothing on it can
 * lead into the intervention flow.
 *
 * There is no Continue. The only way on is back out to the start, and the
 * attempt — text, shortcut, interpretation — is cleared on arrival so that
 * pressing back cannot resume it.
 *
 * SAFETY REVIEW REQUIRED. This repository contains no approved support copy
 * and no regional crisis resources, and neither may be invented: wording and
 * resources have to come from someone with crisis experience. The notice below
 * is rendered on purpose and must stay until that copy exists.
 */
export default function SupportScreen() {
  const { clearSituationText, setShortcut } = useSessionDraft();
  const { reset } = useSessionFlow();

  const leave = () => {
    // Belt and braces: `understanding` already reset the flow before routing
    // here, and this clears the person's words too.
    clearSituationText();
    setShortcut(null);
    reset();
    replaceWith('arrival');
  };

  return (
    <ElseaScreen
      screen="support"
      heading={SupportCopy.heading}
      supporting={SupportCopy.supporting}
      action={<ElseaFlowAction label={SupportCopy.action} onPress={leave} />}>
      <View style={styles.notice}>
        <Text style={styles.noticeText} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
          {SupportCopy.developmentNotice}
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
