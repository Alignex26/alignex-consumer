import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import { AccountCopy, ErrorCopy } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02, ElseaS02Color } from '@/constants/elsea';
import { useAuth } from '@/state/auth';

const C = ElseaS02Color;

/**
 * SIGN IN.
 *
 * Supabase Auth's email one-time link, which is what the project's existing
 * auth supports without additional configuration. No password field, because
 * adding one would mean choosing a password policy and a reset flow that
 * nobody has specified; no social providers, because none are configured and
 * inventing them would be a product decision.
 *
 * The email box is the one text input in the flow outside Screen 02, and what
 * goes in it is an address rather than something the person feels — it is not
 * logged, and it never touches an analytics event.
 */
export default function SignInScreen() {
  const { signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const valid = /\S+@\S+\.\S+/.test(email.trim());

  const send = async () => {
    if (!valid || sending) return;
    setSending(true);
    setFailed(false);

    const ok = await signInWithEmail(email.trim());

    setSending(false);
    if (ok) setSent(true);
    else setFailed(true);
  };

  return (
    <ElseaScreen
      screen="sign_in"
      onBack={goBack}
      heading={AccountCopy.signInHeading}
      action={
        sent ? undefined : (
          <ElseaFlowAction
            label={AccountCopy.signInAction}
            onPress={() => void send()}
            disabled={!valid || sending}
          />
        )
      }>
      {sent ? (
        <Text style={styles.body} accessibilityLiveRegion="polite">
          {AccountCopy.signInSent}
        </Text>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
            {AccountCopy.emailLabel}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            keyboardAppearance="light"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            accessibilityLabel={AccountCopy.emailLabel}
            maxFontSizeMultiplier={ElseaFontScaleCap.input}
          />
          {failed ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {ErrorCopy.supporting}
            </Text>
          ) : null}
        </View>
      )}
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: 26,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: C.prompt,
  },
  input: {
    marginTop: 8,
    height: 52,
    borderRadius: ElseaS02.inputRadius,
    borderWidth: 1,
    borderColor: C.inputBorder,
    backgroundColor: C.inputSurface,
    paddingHorizontal: 16,
    fontSize: 16,
    color: C.inputText,
  },
  body: {
    marginTop: 26,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: C.prompt,
  },
  error: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: '#FFB4B4',
  },
});
