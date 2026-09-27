import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon, Input, Text, TopBar } from '@/components';
import { useAppConfig } from '@/api/queries';
import { t } from '@/theme';
import { ErrorNotice } from './CheckoutFooter';
import type { useCheckout } from './useCheckout';

/**
 * 3-D Secure addımı. Server `payment.status === 'requires_action'` qaytaranda
 * açılır; kod `POST /bookings/:id/pay { otp }` ilə göndərilir. Səhv kod yenə
 * `requires_action` qaytarır — onda `wrong` true olur.
 */
export function OtpSheet({
  visible,
  wrong,
  attempt,
  busy,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  wrong: boolean;
  /** Hər server cavabında artır — səhv koddan sonra sahə təmizlənir. */
  attempt: number;
  busy: boolean;
  onSubmit: (code: string) => void;
  onCancel: () => void;
}) {
  const config = useAppConfig();
  const [code, setCode] = useState('');

  // Səhv koddan sonra sahə təmizlənir ki, yenisi yazılsın
  useEffect(() => {
    setCode('');
  }, [visible, attempt]);

  const ready = code.length === 6;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? [] : ['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TopBar title="3-D Secure" actions={[{ icon: 'x', label: 'Ödənişi dayandır', onPress: onCancel }]} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.icon}>
              <Icon name="lock" size={28} color={t.colors.green900} />
            </View>
            <Text variant="titleLg" center>
              Bankın təsdiq kodu
            </Text>
            <Text variant="body" color="ink2" center>
              Bankınız ödənişi təsdiqləmək üçün 6 rəqəmli kod göndərdi. Kodu daxil edin.
            </Text>

            <Input
              accessibilityLabel="Təsdiq kodu"
              placeholder="••••••"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              style={styles.codeInput}
            />

            {wrong ? <ErrorNotice message="Kod yanlışdır — yenidən yoxlayın" /> : null}
            {config.data?.payments.isMock ? (
              <Text variant="caption" color="muted" center>
                Test kodu: 123456
              </Text>
            ) : null}

            <Button
              label="Təsdiqlə"
              onPress={() => onSubmit(code)}
              disabled={!ready}
              loading={busy}
              style={styles.cta}
            />
            <Button label="Ləğv et" variant="ghost" onPress={onCancel} disabled={busy} style={styles.cta} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/** `useCheckout` vəziyyətinə bağlanmış 3-D Secure vərəqi. */
export function CheckoutOtp({ checkout }: { checkout: ReturnType<typeof useCheckout> }) {
  return (
    <OtpSheet
      visible={checkout.otp !== null}
      wrong={checkout.otp?.wrong ?? false}
      attempt={checkout.otp?.attempt ?? 0}
      busy={checkout.busy}
      onSubmit={(code) => void checkout.submitOtp(code)}
      onCancel={checkout.cancelOtp}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.colors.bg },
  flex: { flex: 1 },
  body: { padding: t.spacing.page, gap: t.spacing.lg, alignItems: 'stretch' },
  icon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.green050,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: t.spacing.lg,
  },
  codeInput: { fontSize: 22, letterSpacing: 8, textAlign: 'center' },
  cta: { width: '100%' },
});
