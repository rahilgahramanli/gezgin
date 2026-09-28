import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, EmptyState, Icon, Loading, Pill, Screen, Text, TopBar } from '@/components';
import { usePaymentMethods, useRemoveCard, useSetDefaultCard, type PaymentMethod } from '@/api/hooks/booking';
import { useT } from '@/i18n';
import { alertError } from '@/lib/errors';
import { cardTitle, expiryLabel } from '@/lib/card';
import { useIsGuest } from '@/store/auth';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import { AddCardSheet, GuestGate, errorText } from './parts';

/** "Ödəniş üsullarım" — saxlanmış kartlar: əsas et, sil, yeni kart əlavə et. */
export function PaymentMethodsScreen({ navigation }: AppScreenProps<'PaymentMethods'>) {
  const { t: tr } = useT('booking');
  const isGuest = useIsGuest();
  const methods = usePaymentMethods(!isGuest);
  const setDefault = useSetDefaultCard();
  const remove = useRemoveCard();
  const [adding, setAdding] = useState(false);

  const confirmRemove = (m: PaymentMethod) =>
    Alert.alert(
      tr('cards.removeTitle'),
      `${tr('cards.removeMessage', { card: cardTitle(m) })}${m.isDefault ? ` ${tr('cards.removeDefaultNote')}` : ''}`,
      [
        { text: tr('common:actions.cancel'), style: 'cancel' },
        {
          text: tr('common:actions.delete'),
          style: 'destructive',
          onPress: () => remove.mutate(m.publicId, { onError: (e) => alertError(e, tr('cards.removeFailed')) }),
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
            label={tr('cards.add')}
            left={<Icon name="plus" size={18} color="#fff" />}
            onPress={() => setAdding(true)}
            style={styles.wide}
          />
        ) : undefined
      }
    >
      <TopBar title={tr('cards.title')} onBack={navigation.goBack} />

      <View style={styles.body}>
        {isGuest ? (
          <GuestGate
            title={tr('cards.guestTitle')}
            message={tr('cards.guestMessage')}
          />
        ) : methods.isLoading ? (
          <Loading />
        ) : methods.isError ? (
          <EmptyState
            icon="info"
            title={tr('cards.loadFailed')}
            message={errorText(methods.error)}
            action={<Button label={tr('shared.reload')} variant="soft" onPress={() => void methods.refetch()} />}
          />
        ) : !list.length ? (
          <EmptyState
            icon="coins"
            title={tr('cards.emptyTitle')}
            message={tr('cards.emptyMessage')}
            action={
              <Button
                label={tr('cards.add')}
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
                      {m.isDefault ? <Pill label={tr('cards.default')} tone="green" /> : null}
                    </View>
                    <Text variant="caption" color={m.isExpired ? 'danger' : 'muted'}>
                      {m.isExpired ? tr('cards.expired') : tr('cards.expires', { date: expiryLabel(m) })}
                      {m.holderName ? ` · ${m.holderName}` : ''}
                    </Text>
                    {!m.isDefault && !m.isExpired ? (
                      <Pressable
                        onPress={() =>
                          setDefault.mutate(m.publicId, { onError: (e) => alertError(e, tr('cards.setDefaultFailed')) })
                        }
                        disabled={busy}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={tr('cards.makeDefaultA11y', { card: title })}
                        style={styles.makeDefault}
                      >
                        <Text variant="small" color="green900" style={styles.link}>
                          {tr('cards.makeDefault')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => confirmRemove(m)}
                    disabled={busy}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={tr('cards.removeA11y', { card: title })}
                    style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
                  >
                    <Icon name="trash" size={20} color={t.colors.danger} />
                  </Pressable>
                </Card>
              );
            })}
            <Text variant="caption" color="muted" style={styles.note}>
              {tr('cards.note')}
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
