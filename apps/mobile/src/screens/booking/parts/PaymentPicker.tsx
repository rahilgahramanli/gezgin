import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Loading, Pill, Text } from '@/components';
import { usePaymentMethods, type PaymentMethod } from '@/api/hooks/booking';
import { useT } from '@/i18n';
import { cardTitle, expiryLabel } from '@/lib/card';
import { t } from '@/theme';
import { AddCardSheet } from './AddCardSheet';

/**
 * Ekran 18, 49, 53 "Ödəniş üsulu": saxlanmış kartlardan biri seçilir (radio)
 * və ya yeni kart əlavə edilir. Əvvəl tətbiq istifadəçidən xəbərsiz test kartı
 * (4111) əlavə edirdi — indi kart yalnız istifadəçinin öz formasından gəlir.
 *
 * Əsas kart avtomatik seçilir; kart yoxdursa seçim `null` qalır və ödəniş
 * düyməsi passivdir.
 */
export function PaymentPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (publicId: string | null) => void;
}) {
  const { t: tr } = useT('booking');
  const methods = usePaymentMethods();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const list = methods.data;
    if (!list) return;
    if (selected && list.some((m) => m.publicId === selected && !m.isExpired)) return;
    const fallback = list.find((m) => m.isDefault && !m.isExpired) ?? list.find((m) => !m.isExpired);
    onSelect(fallback?.publicId ?? null);
    // Yalnız siyahı dəyişəndə — istifadəçinin seçimini hər renderdə ləğv etməmək üçün
  }, [methods.data]);

  return (
    <View style={styles.wrap}>
      {methods.isLoading ? (
        <Loading />
      ) : methods.isError ? (
        <Card padded style={styles.notice}>
          <Icon name="info" size={20} color={t.colors.danger} />
          <Text variant="small" color="ink2" style={styles.flex}>
            {tr('picker.loadFailed')}
          </Text>
          <Button label={tr('shared.reload')} size="xs" variant="soft" onPress={() => void methods.refetch()} />
        </Card>
      ) : methods.data?.length ? (
        methods.data.map((m) => (
          <CardOption key={m.publicId} method={m} active={m.publicId === selected} onPress={() => onSelect(m.publicId)} />
        ))
      ) : (
        <Card padded style={styles.notice}>
          <Icon name="info" size={20} color={t.colors.brown700} />
          <Text variant="small" color="ink2" style={styles.flex}>
            {tr('picker.empty')}
          </Text>
        </Card>
      )}

      <Button
        label={tr('cards.add')}
        variant="outline"
        size="sm"
        left={<Icon name="plus" size={16} color={t.colors.green900} />}
        onPress={() => setAdding(true)}
      />

      <AddCardSheet visible={adding} onClose={() => setAdding(false)} onAdded={(card) => onSelect(card.publicId)} />
    </View>
  );
}

function CardOption({ method, active, onPress }: { method: PaymentMethod; active: boolean; onPress: () => void }) {
  const { t: tr } = useT('booking');
  const title = cardTitle(method);
  return (
    <Pressable
      onPress={onPress}
      disabled={method.isExpired}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: active, disabled: method.isExpired }}
    >
      <Card padded style={[styles.option, active && styles.optionActive, method.isExpired && styles.optionOff]}>
        <View style={[styles.radio, active && styles.radioOn]}>{active ? <View style={styles.radioDot} /> : null}</View>
        <View style={styles.flex}>
          <Text variant="h3">{title}</Text>
          <Text variant="caption">
            {method.isExpired ? tr('cards.expired') : tr('cards.expires', { date: expiryLabel(method) })}
            {method.holderName ? ` · ${method.holderName}` : ''}
          </Text>
        </View>
        {method.isDefault ? <Pill label={tr('cards.default')} tone="green" /> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: t.spacing.sm },
  notice: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  optionActive: { borderColor: t.colors.green900, backgroundColor: t.colors.green050 },
  optionOff: { opacity: 0.5 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: t.colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: t.colors.green900 },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: t.colors.green900 },
  flex: { flex: 1, minWidth: 0 },
});
