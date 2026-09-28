import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Input, Screen, Text, TopBar } from '@/components';
import { useLogin } from '@/api/hooks/auth';
import { ApiError } from '@/api/client';
import { t } from '@/theme';
import { useT } from '@/i18n';
import type { AuthScreenProps } from '@/navigation/types';

/** Ekran 02 — daxil ol. */
export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { t: tr } = useT('auth');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const error =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? tr('login.networkError')
        : null;

  const submit = () => {
    if (!identifier.trim() || !password) return;
    login.mutate({ identifier: identifier.trim(), password });
  };

  return (
    <Screen scroll={false} padded={false}>
      <TopBar onBack={navigation.canGoBack() ? navigation.goBack : undefined} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Text variant="titleXl">{tr('login.title')}</Text>
          <Text variant="meta" style={styles.sub}>
            {tr('login.sub')}
          </Text>

          <View style={styles.form}>
            <Input
              label={tr('login.identifier')}
              icon="mail"
              placeholder="aysel@gezgin.app"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={identifier}
              onChangeText={setIdentifier}
            />
            <Input
              label={tr('fields.password')}
              icon="lock"
              placeholder="••••••••"
              secure
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              returnKeyType="go"
              error={error}
            />
            <Text
              variant="small"
              color="green900"
              style={styles.forgot}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              {tr('login.forgot')}
            </Text>
          </View>

          <Button
            label={tr('login.submit')}
            onPress={submit}
            loading={login.isPending}
            disabled={!identifier.trim() || !password}
          />

          <Text variant="meta" center style={styles.footer}>
            {tr('login.noAccount')}{' '}
            <Text variant="meta" color="green900" onPress={() => navigation.navigate('Register')}>
              {tr('common:actions.signUp')}
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: t.spacing.page, paddingTop: t.spacing.sm },
  sub: { marginTop: 6 },
  form: { gap: t.spacing.lg, marginTop: t.spacing.xxl, marginBottom: t.spacing.xxl },
  forgot: { textAlign: 'right', fontWeight: '500' },
  footer: { marginTop: 'auto', paddingBottom: t.spacing.xl },
});
