import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Icon, Input, Screen, Text, TopBar } from '@/components';
import { useForgotPassword, useResetPassword } from '@/api/hooks/auth';
import { ApiError } from '@/api/client';
import { t } from '@/theme';
import { useT } from '@/i18n';
import type { AuthScreenProps } from '@/navigation/types';

/** E-mail-i qalın yazmaq üçün tərcümədə yerini tutan nişan — söz sırası dildən asılıdır. */
const EMAIL_MARK = '\u0001';

/** Ekran 37 → 38 — şifrəni bərpa et və kodla yeni şifrə təyin et. */
export function ForgotPasswordScreen({ navigation }: AuthScreenProps<'ForgotPassword'>) {
  const { t: tr } = useT('auth');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const forgot = useForgotPassword();
  const reset = useResetPassword();

  const error =
    reset.error instanceof ApiError ? reset.error.message : forgot.error ? tr('forgot.codeNotSent') : null;

  // "{{email}} ünvanına…" / "…sent to {{email}}." — e-mail cümlənin istənilən yerində ola bilər
  const [sentBefore = '', sentAfter = ''] = tr('forgot.codeSent', { email: EMAIL_MARK }).split(EMAIL_MARK);

  const sendCode = () =>
    forgot.mutate(
      { email: email.trim().toLowerCase() },
      { onSuccess: () => setStep('code') },
    );

  const submitReset = () =>
    reset.mutate(
      { email: email.trim().toLowerCase(), code, newPassword: password },
      {
        onSuccess: () => {
          Alert.alert(tr('forgot.doneTitle'), tr('forgot.doneMessage'));
          navigation.navigate('Login');
        },
      },
    );

  return (
    <Screen padded={false}>
      <TopBar
        title={step === 'email' ? tr('forgot.title') : tr('forgot.codeTitle')}
        onBack={step === 'code' ? () => setStep('email') : navigation.goBack}
      />

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Icon name="lock" size={28} color={t.colors.green900} />
        </View>

        {step === 'email' ? (
          <>
            <Text variant="titleLg" center>
              {tr('forgot.heading')}
            </Text>
            <Text variant="meta" center style={styles.sub}>
              {tr('forgot.sub')}
            </Text>

            <Input
              label={tr('fields.email')}
              icon="mail"
              placeholder="aysel@gezgin.app"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              error={error}
              style={styles.field}
            />

            <Button
              label={tr('forgot.sendCode')}
              onPress={sendCode}
              loading={forgot.isPending}
              disabled={!email.includes('@')}
              style={styles.cta}
            />
          </>
        ) : (
          <>
            <Text variant="titleLg" center>
              {tr('forgot.enterCode')}
            </Text>
            <Text variant="meta" center style={styles.sub}>
              {sentBefore}
              <Text variant="meta" style={styles.bold}>
                {email}
              </Text>
              {sentAfter}
            </Text>

            {/* Dev rejimdə API kodu cavabda qaytarır — Mailhog-a baxmadan test etmək üçün */}
            {forgot.data?.devCode ? (
              <View style={styles.devHint}>
                <Text variant="small" color="green900">
                  {tr('forgot.devCode', { code: forgot.data.devCode })}
                </Text>
              </View>
            ) : null}

            <Input
              label={tr('forgot.codeLabel')}
              icon="check"
              placeholder="482715"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              style={styles.field}
            />
            <Input
              label={tr('forgot.newPassword')}
              icon="lock"
              placeholder={tr('fields.passwordHint')}
              secure
              value={password}
              onChangeText={setPassword}
              error={error}
              style={styles.field}
            />

            <Button
              label={tr('forgot.submit')}
              onPress={submitReset}
              loading={reset.isPending}
              disabled={code.length !== 6 || password.length < 8}
              style={styles.cta}
            />
            <Button
              label={tr('forgot.resend')}
              variant="ghost"
              onPress={sendCode}
              loading={forgot.isPending}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.md },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: t.colors.green100,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: t.spacing.lg,
    marginBottom: t.spacing.md,
  },
  sub: { marginBottom: t.spacing.md },
  bold: { fontWeight: '700', color: t.colors.ink },
  field: { marginTop: 0 },
  cta: { marginTop: t.spacing.sm },
  devHint: {
    backgroundColor: t.colors.green100,
    padding: t.spacing.md,
    borderRadius: t.radius.md,
    alignItems: 'center',
  },
});
