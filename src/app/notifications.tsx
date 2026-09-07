import { StyleSheet, Text } from 'react-native';

import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { YouCopy } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';

const C = ElseaS02Color;

/**
 * SCREEN 21 — NOTIFICATIONS.
 *
 * PRODUCT DECISION REQUIRED.
 *
 * `expo-notifications` is installed but nothing schedules or sends anything,
 * and no notification behaviour has been approved. There is therefore nothing
 * honest to offer a switch for.
 *
 * Note what this screen deliberately does NOT do: it does not ask for
 * notification permission. Prompting for a permission the product cannot yet
 * use spends the one chance iOS gives us, and would be asking for something
 * before knowing what it is for.
 */
export default function NotificationsScreen() {
  return (
    <ElseaScreen screen="notifications" onBack={goBack} heading={YouCopy.notificationsHeading}>
      <Text style={styles.body} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
        ELSEA doesn’t send you anything yet.
      </Text>
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: 26,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: C.prompt,
  },
});
