import { StyleSheet, Text, View } from 'react-native';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import { AccountCopy, YouCopy } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import { track } from '@/lib/analytics';
import { navigateTo } from '@/navigation/elsea-routes';
import { useAuth } from '@/state/auth';

const C = ElseaS02Color;

/**
 * SCREEN 22 — ACCOUNT.
 *
 * Signed out, this is the case for having one: an account is what lets ELSEA
 * remember which sessions worked. It is deliberately offered here rather than
 * demanded up front — the whole flow runs anonymously, and asking before
 * someone has had a session would be asking before there is anything to keep.
 *
 * Signed in, it is a sign-out and nothing else. There is no profile to edit,
 * because there is no profile.
 */
export default function AccountScreen() {
  const { session, userId, signOut } = useAuth();

  const create = () => {
    track({ name: 'account_created' });
    navigateTo('signIn');
  };

  return (
    <ElseaScreen
      screen="account"
      onBack={goBack}
      heading={userId ? YouCopy.accountHeading : AccountCopy.createHeading}
      action={
        userId ? undefined : (
          <ElseaFlowAction label={AccountCopy.signInAction} onPress={create} />
        )
      }>
      {userId ? (
        <View style={styles.block}>
          <Text style={styles.body} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
            {session?.user?.email ?? 'Signed in'}
          </Text>
          <View style={styles.signOut}>
            <ElseaTextAction label="Sign out" onPress={() => void signOut()} />
          </View>
        </View>
      ) : (
        <Text style={styles.body} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
          {AccountCopy.createSupporting}
        </Text>
      )}
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 26,
  },
  body: {
    marginTop: 26,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: C.prompt,
  },
  signOut: {
    marginTop: 20,
    alignItems: 'flex-start',
  },
});
