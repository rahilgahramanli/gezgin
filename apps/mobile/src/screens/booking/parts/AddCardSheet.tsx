import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Text, TopBar } from '@/components';
import { useAddCard, type AddedCard } from '@/api/hooks/booking';
import { useAppConfig } from '@/api/queries';
import { useT } from '@/i18n';
import {
  cardBrand, brandLabel, formatCardNumber, formatExpiry, validateCard, type CardFormErrors, type CardFormValues,
} from '@/lib/card';
import { t } from '@/theme';
import { ErrorNotice } from './CheckoutFooter';
import { errorText } from './useCheckout';

const EMPTY: CardFormValues = { number: '', expiry: '', cvc: '', holderName: '' };

/**
 * Kart əlavə etmə forması (alt vərəq). Rezervasiya, otel rezervasiyası,
 * rezervasiya detalı və "Ödəniş üsullarım" ekranları eyni formanı açır.
 * Əlavə olunan kart `onAdded` ilə qaytarılır — çağıran onu seçir.
 */
export function AddCardSheet({
  visible,
  onClose,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded?: (card: AddedCard) => void;
}) {
  const { t: tr } = useT('booking');
  const add = useAddCard();
  const config = useAppConfig();
  const [values, setValues] = useState<CardFormValues>(EMPTY);
  const [errors, setErrors] = useState<CardFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const set = (key: keyof CardFormValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Düzəliş edilən sahənin xətası dərhal götürülür
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const close = () => {
    setValues(EMPTY);
    setErrors({});
    setServerError(null);
    add.reset();
    onClose();
  };

  const save = () => {
    const result = validateCard(values);
    setErrors(result.errors);
    setServerError(null);
    if (!result.payload) return;
    add.mutate(result.payload, {
      onSuccess: (card) => {
        onAdded?.(card);
        close();
      },
      onError: (e) => setServerError(errorText(e, tr('addCard.failed'))),
    });
  };

  const brand = cardBrand(values.number);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={close}
    >
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? [] : ['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TopBar
            title={tr('cards.add')}
            actions={[{ icon: 'x', label: tr('common:actions.close'), onPress: close }]}
          />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Input
              label={tr('addCard.number')}
              accessibilityLabel={tr('addCard.number')}
              placeholder="0000 0000 0000 0000"
              keyboardType="number-pad"
              textContentType="creditCardNumber"
              autoComplete="cc-number"
              value={values.number}
              onChangeText={(v) => set('number', formatCardNumber(v))}
              maxLength={23}
              error={errors.number}
              right={
                values.number ? (
                  <Text variant="caption" color="muted">
                    {brandLabel(brand)}
                  </Text>
                ) : undefined
              }
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Input
                  label={tr('addCard.expiry')}
                  accessibilityLabel={tr('addCard.expiry')}
                  placeholder={tr('addCard.expiryPlaceholder')}
                  keyboardType="number-pad"
                  autoComplete="cc-exp"
                  value={values.expiry}
                  onChangeText={(v) => set('expiry', formatExpiry(v))}
                  maxLength={5}
                  error={errors.expiry}
                />
              </View>
              <View style={styles.flex}>
                <Input
                  label="CVC"
                  accessibilityLabel="CVC"
                  placeholder="123"
                  keyboardType="number-pad"
                  autoComplete="cc-csc"
                  secureTextEntry
                  value={values.cvc}
                  onChangeText={(v) => set('cvc', v.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  error={errors.cvc}
                />
              </View>
            </View>
            <Input
              label={tr('addCard.holder')}
              accessibilityLabel={tr('addCard.holderA11y')}
              placeholder={tr('addCard.holderPlaceholder')}
              autoCapitalize="characters"
              autoComplete="cc-name"
              value={values.holderName}
              onChangeText={(v) => set('holderName', v)}
              maxLength={120}
              error={errors.holderName}
            />

            <Text variant="caption" color="muted">
              {tr('addCard.tokenNote')}
            </Text>
            {config.data?.payments.isMock ? (
              <Text variant="caption" color="muted">
                {tr('addCard.testMode')}
              </Text>
            ) : null}

            {serverError ? <ErrorNotice message={serverError} /> : null}

            <Button label={tr('addCard.save')} onPress={save} loading={add.isPending} style={styles.cta} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.colors.bg },
  flex: { flex: 1, minWidth: 0 },
  body: { padding: t.spacing.page, gap: t.spacing.lg, paddingBottom: t.spacing.xxl * 2 },
  row: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'flex-start' },
  cta: { width: '100%', marginTop: t.spacing.sm },
});
