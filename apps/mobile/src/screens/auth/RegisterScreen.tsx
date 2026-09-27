import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Input, Screen, Text, TopBar } from '@/components';
import { useRegister } from '@/api/hooks/auth';
import { ApiError } from '@/api/client';
import { t } from '@/theme';
import { sanitizeUsername } from '@/lib/username';
import type { AuthScreenProps } from '@/navigation/types';

/** Ekran 03 — qeydiyyat. */
export function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const register = useRegister();

  /**
   * Backend sahə səviyyəsində xəta qaytarır (`details`), amma sadə hallarda
   * ümumi mesaj kifayətdir — istifadəçiyə hansı sahənin problemli olduğunu
   * kod (`EMAIL_TAKEN`, `USERNAME_TAKEN`) üzrə göstəririk.
   */
  const err = register.error instanceof ApiError ? register.error : null;
  const emailError = err?.code === 'EMAIL_TAKEN' ? err.message : null;
  const usernameError = err?.code === 'USERNAME_TAKEN' ? err.message : null;
  const generalError = err && !emailError && !usernameError ? err.message : null;

  const canSubmit =
    fullName.trim().length >= 2 && username.trim().length >= 3 && email.includes('@') && password.length >= 8;

  return (
    <Screen scroll padded={false}>
      <TopBar title="Qeydiyyat" onBack={navigation.goBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <Text variant="titleXl">Hesab yarat</Text>
          <Text variant="meta" style={styles.sub}>
            Gezgin icmasına qoşul, kəşf et və paylaş
          </Text>

          <View style={styles.form}>
            <Input
              label="Ad Soyad"
              icon="user"
              placeholder="Aysel Məmmədova"
              value={fullName}
              onChangeText={setFullName}
            />
            <Input
              label="İstifadəçi adı"
              icon="at"
              placeholder="aysel.go"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              value={username}
              onChangeText={(v) => setUsername(sanitizeUsername(v))}
              error={usernameError}
            />
            <Input
              label="E-mail"
              icon="mail"
              placeholder="aysel@gezgin.app"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              error={emailError}
            />
            <Input
              label="Şifrə"
              icon="lock"
              placeholder="Ən azı 8 simvol"
              secure
              value={password}
              onChangeText={setPassword}
              error={generalError}
            />
          </View>

          <Button
            label="Davam et"
            onPress={() => register.mutate({ fullName: fullName.trim(), username: username.trim(), email: email.trim(), password })}
            loading={register.isPending}
            disabled={!canSubmit}
          />

          <Text variant="meta" center style={styles.footer}>
            Artıq hesabın var?{' '}
            <Text variant="meta" color="green900" onPress={() => navigation.navigate('Login')}>
              Daxil ol
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page },
  sub: { marginTop: 6 },
  form: { gap: t.spacing.lg, marginTop: t.spacing.xl, marginBottom: t.spacing.xl },
  footer: { marginTop: t.spacing.lg },
});
