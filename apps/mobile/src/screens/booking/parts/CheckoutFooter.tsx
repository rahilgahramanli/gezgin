import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Text } from '@/components';
import { useGuestSignUp } from '@/api/hooks/auth';
import { t } from '@/theme';

/**
 * Görünən xəta qutusu. Sabit alt panelin (footer) İÇİNDƏ, düymənin üstündə
 * göstərilir — əvvəl xəta scroll kontentinin sonunda, panelin arxasında qalırdı.
 */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <View
      style={styles.error}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <Icon name="info" size={18} color={t.colors.danger} />
      <Text variant="small" color="danger" style={styles.flex}>
        {message}
      </Text>
    </View>
  );
}

/** Ödəniş panelinin məzmunu: xəta və ya ipucu + əsas düymə. */
export function CheckoutFooter({
  error,
  hint,
  label,
  onPress,
  disabled,
  loading,
}: {
  error?: string | null;
  /** Düymə niyə passivdir — "Ödəniş üçün kart seçin". */
  hint?: string | null;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <View style={styles.footer}>
      {error ? (
        <ErrorNotice message={error} />
      ) : hint ? (
        <Text variant="caption" center color="muted">
          {hint}
        </Text>
      ) : null}
      <Button
        label={label}
        onPress={onPress}
        loading={loading}
        disabled={disabled}
        left={<Icon name="lock" size={18} color="#fff" />}
        style={styles.cta}
      />
    </View>
  );
}

/**
 * Qonaq üçün: bütün rezervasiya endpoint-ləri 403 qaytarır. Düymə səssizcə
 * passiv qalmaq əvəzinə səbəbi deyir və qeydiyyata aparır.
 */
export function GuestGate({
  title = 'Rezervasiya üçün hesab yarat',
  message = 'Qonaq rejimində bron etmək, ödəniş etmək və kart saxlamaq mümkün deyil. Pulsuz hesab 1 dəqiqəyə açılır.',
}: {
  title?: string;
  message?: string;
}) {
  const signUp = useGuestSignUp();
  return (
    <Card padded style={styles.guest}>
      <View style={styles.guestHead}>
        <View style={styles.guestIcon}>
          <Icon name="user" size={20} color={t.colors.green900} />
        </View>
        <View style={styles.flex}>
          <Text variant="h3">{title}</Text>
          <Text variant="small" color="ink2">
            {message}
          </Text>
        </View>
      </View>
      <Button
        label="Hesab yarat"
        onPress={() => signUp.mutate()}
        loading={signUp.isPending}
        style={styles.cta}
      />
    </Card>
  );
}

/** Nəfər sayı — ekran 18, 49. `max` seçilmiş tarixdəki boş yerlərdən gəlir. */
export function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const canDec = value > min;
  const canInc = value < max;
  return (
    <View style={styles.stepper}>
      <View style={styles.flex}>
        <Text variant="body">{label}</Text>
        <Text variant="caption">{hint}</Text>
      </View>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          style={[styles.stepBtn, !canDec && styles.stepBtnOff]}
          disabled={!canDec}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${label}: azalt`}
          accessibilityState={{ disabled: !canDec }}
        >
          <Icon name="minus" size={14} color={canDec ? t.colors.green900 : t.colors.muted} strokeWidth={2.4} />
        </Pressable>
        <Text variant="h3" style={styles.stepValue} accessibilityLabel={`${label}: ${value}`}>
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          style={[styles.stepBtn, !canInc && styles.stepBtnOff]}
          disabled={!canInc}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${label}: artır`}
          accessibilityState={{ disabled: !canInc }}
        >
          <Icon name="plus" size={14} color={canInc ? t.colors.green900 : t.colors.muted} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

/** Qiymət sətri — "Böyük × 2 ... 120 AZN". */
export function PriceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text variant={strong ? 'h3' : 'body'} color={strong ? 'ink' : 'ink2'} style={styles.flex}>
        {label}
      </Text>
      <Text variant={strong ? 'h2' : 'body'} color={strong ? 'green900' : 'ink'}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: t.spacing.sm },
  cta: { width: '100%' },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderRadius: t.radius.md,
    backgroundColor: '#FBE9E7',
  },
  guest: { gap: t.spacing.md },
  guestHead: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'flex-start' },
  guestIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.green050,
    alignItems: 'center', justifyContent: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', paddingVertical: t.spacing.md },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnOff: { backgroundColor: t.colors.bg2 },
  stepValue: { minWidth: 20, textAlign: 'center' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.spacing.md },
  flex: { flex: 1, minWidth: 0 },
});
