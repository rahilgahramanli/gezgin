import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, EmptyState, Icon, Loading, Pill, Screen, Text, TopBar } from '@/components';
import { usePaymentMethods, useRemoveCard, useSetDefaultCard, type PaymentMethod } from '@/api/hooks/booking';
import { alertError } from '@/lib/errors';
import { cardTitle, expiryLabel } from '@/lib/card';
import { useIsGuest } from '@/store/auth';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import { AddCardSheet, GuestGate, errorText } from './parts';

/** "Ödəniş üsullarım" — saxlanmış kartlar: əsas et, sil, yeni kart əlavə et. */
export function PaymentMethodsScreen({ navigation }: AppScreenProps<'PaymentMethods'>) {
  const isGuest = useIsGuest();
  const methods = usePaymentMethods(!isGuest);
  const setDefault = useSetDefaultCard();
  const remove = useRemoveCard();
  const [adding, setAdding] = useState(false);

  const confirmRemove = (m: PaymentMethod) =>
    Alert.alert(
      'Kartı silmək?',
      `${cardTitle(m)} ödəniş üsullarından silinəcək.${m.isDefault ? ' Əsas kart başqa karta keçəcək.' : ''}`,
      [
        { text: 'İmtina', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => remove.mutate(m.publicId, { onError: (e) => alertError(e, 'Kart silinmədi') }),
        },
      ],
    );

  const list = methods.data ?? [];

  return (
    <Screen
      padded={false}
      footer={
        !isGuest && list.length ? (
          <Button
            label="Kart əlavə et"
            left={<Icon name="plus" size={18} color="#fff" />}
            onPress={() => setAdding(true)}
            style={styles.wide}
          />
        ) : undefined
      }
    >
      <TopBar title="Ödəniş üsullarım" onBack={navigation.goBack} />

      <View style={styles.body}>
        {isGuest ? (
          <GuestGate
            title="Kart saxlamaq üçün hesab yarat"
            message="Qonaq rejimində kart əlavə etmək və ödəniş etmək mümkün deyil."
          />
        ) : methods.isLoading ? (
          <Loading />
        ) : methods.isError ? (
          <EmptyState
            icon="info"
            title="Kartlar yüklənmədi"
            message={errorText(methods.error)}
            action={<Button label="Yenidən yüklə" variant="soft" onPress={() => void methods.refetch()} />}
          />
        ) : !list.length ? (
          <EmptyState
            icon="coins"
            title="Kart əlavə edilməyib"
            message="Rezervasiyanı tez ödəmək üçün bank kartını yadda saxla. Kart nömrəsi GEZGIN-də saxlanılmır."
            action={
              <Button
                label="Kart əlavə et"
                left={<Icon name="plus" size={18} color="#fff" />}
                onPress={() => setAdding(true)}
              />
            }
          />
        ) : (
          <View style={styles.list}>
            {list.map((m) => {
              const title = cardTitle(m);
              const busy = (setDefault.isPending && setDefault.variables === m.publicId)
                || (remove.isPending && remove.variables === m.publicId);
              return (
                <Card key={m.publicId} padded style={[styles.card, m.isExpired && styles.expired]}>
                  <View style={styles.cardIcon}>
                    <Icon name="coins" size={20} color={t.colors.green900} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.titleRow}>
                      <Text variant="h3">{title}</Text>
                      {m.isDefault ? <Pill label="Əsas" tone="green" /> : null}
                    </View>
                    <Text variant="caption" color={m.isExpired ? 'danger' : 'muted'}>
                      {m.isExpired ? 'Müddəti bitib' : `Bitmə tarixi ${expiryLabel(m)}`}
                      {m.holderName ? ` · ${m.holderName}` : ''}
                    </Text>
                    {!m.isDefault && !m.isExpired ? (
                      <Pressable
                        onPress={() => setDefault.mutate(m.publicId, { onError: (e) => alertError(e, 'Əsas kart dəyişmədi') })}
                        disabled={busy}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Əsas et: ${title}`}
                        style={styles.makeDefault}
                      >
                        <Text variant="small" color="green900" style={styles.link}>
                          Əsas et
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => confirmRemove(m)}
                    disabled={busy}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Kartı sil: ${title}`}
                    style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
                  >
                    <Icon name="trash" size={20} color={t.colors.danger} />
                  </Pressable>
                </Card>
              );
            })}
            <Text variant="caption" color="muted" style={styles.note}>
              Əsas kart rezervasiyada avtomatik seçilir. Kart nömrəsi GEZGIN-də saxlanılmır — ödəniş
              provayderində tokenləşdirilir.
            </Text>
          </View>
        )}
      </View>

      <AddCardSheet visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page },
  list: { gap: t.spacing.md },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.md },
  expired: { opacity: 0.6 },
  cardIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.green050,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' },
  makeDefault: { alignSelf: 'flex-start', marginTop: t.spacing.sm },
  link: { fontWeight: '600' },
  remove: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  pressed: { opacity: 0.5 },
  note: { marginTop: t.spacing.sm },
  wide: { width: '100%' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
