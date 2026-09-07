import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button, Card, EmptyState, Icon, Loading, Pill, Screen, Text, TopBar,
} from '@/components';
import { useAddCard, useAvailability, useCreateBooking, usePaymentMethods, usePayBooking, useQuote } from '@/api/hooks/booking';
import { useExperienceDetail } from '@/api/hooks/details';
import { ApiError } from '@/api/client';
import { durationLabel } from '@/lib/labels';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 18 — rezervasiya: tarix, nəfər sayı, qiymət bölgüsü, ödəniş. */
export function BookingScreen({ route, navigation }: AppScreenProps<'Booking'>) {
  const { experience: slug } = route.params;
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [slotId, setSlotId] = useState<number | undefined>();

  const detail = useExperienceDetail(slug);
  const methods = usePaymentMethods();
  const quote = useQuote({ type: 'experience', target: slug, adults, children, slotId });
  const createBooking = useCreateBooking();
  const pay = usePayBooking();
  const addCard = useAddCard();

  const busy = createBooking.isPending || pay.isPending || addCard.isPending;
  const error =
    createBooking.error instanceof ApiError
      ? createBooking.error.message
      : pay.error instanceof ApiError
        ? pay.error.message
        : null;

  /**
   * Bron → ödəniş. Ödəniş üçün tokenləşdirilmiş kart lazımdır; istifadəçidə
   * kart yoxdursa test kartı əlavə edilir (mock provayder — real PSP gələndə
   * bu addım kart formasına əvəz olunacaq).
   */
  const confirm = async () => {
    const existing = methods.data?.find((m) => m.isDefault) ?? methods.data?.[0];
    const method =
      existing ??
      (await addCard.mutateAsync({
        number: '4111111111111111',
        expMonth: 12,
        expYear: 2030,
        cvv: '123',
        holderName: 'TEST KART',
      }));

    createBooking.mutate(
      { type: 'experience', target: slug, adults, children, slotId },
      {
        onSuccess: (booking) => {
          pay.mutate(
            { publicId: booking.publicId, paymentMethod: method.publicId },
            { onSuccess: () => navigation.replace('BookingSuccess', { publicId: booking.publicId }) },
          );
        },
      },
    );
  };

  if (detail.isLoading) return <Loading label="Yüklənir…" />;

  return (
    <Screen
      padded={false}
      footer={
        <Button
          label={quote.data ? `${quote.data.totalAzn} AZN ödə və bron et` : 'Bron et'}
          onPress={confirm}
          loading={busy}
          disabled={!quote.data}
          left={<Icon name="lock" size={18} color="#fff" />}
          style={styles.ctaButton}
        />
      }
    >
      <TopBar title="Rezervasiya" onBack={navigation.goBack} />

      <View style={styles.body}>
        {detail.data ? (
          <Card padded style={styles.summary}>
            <Text variant="h3">{detail.data.title}</Text>
            <Text variant="meta">
              {detail.data.region.name}
              {detail.data.durationText ? ` · ${durationLabel(detail.data.durationText)}` : ''}
            </Text>
            <Text variant="h3" color="green900">
              {detail.data.pricing.priceAzn} AZN / nəfər
            </Text>
          </Card>
        ) : null}

        {/* Tarix seçimi — ekran 18 date strip */}
        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Tarix seç
          </Text>
          {detail.data?.nextAvailable ? (
            <SlotPicker slug={slug} selected={slotId} onSelect={setSlotId} />
          ) : (
            <Text variant="meta">Bu təcrübə üçün hələ tarix açılmayıb</Text>
          )}
        </View>

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Nəfər sayı
          </Text>
          <Stepper label="Böyük" hint="13 yaş və yuxarı" value={adults} min={1} onChange={setAdults} />
          <Stepper label="Uşaq" hint="0–12 yaş · 50% endirim" value={children} min={0} onChange={setChildren} />
        </View>

        {quote.data ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              Qiymət
            </Text>
            <Card padded style={styles.price}>
              {quote.data.lines.map((line) => (
                <View key={line.code} style={styles.priceRow}>
                  <Text variant="body" color="ink2">
                    {line.label} × {line.quantity}
                  </Text>
                  <Text variant="body">{line.totalAzn} AZN</Text>
                </View>
              ))}
              {quote.data.serviceFeeAzn > 0 ? (
                <View style={styles.priceRow}>
                  <Text variant="body" color="ink2">
                    Xidmət haqqı
                  </Text>
                  <Text variant="body">{quote.data.serviceFeeAzn} AZN</Text>
                </View>
              ) : null}
              <View style={styles.total}>
                <Text variant="h3">Cəmi</Text>
                <Text variant="h2" color="green900">
                  {quote.data.totalAzn} AZN
                </Text>
              </View>
            </Card>
          </View>
        ) : quote.isLoading ? (
          <Loading />
        ) : null}

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Ödəniş üsulu
          </Text>
          {methods.data?.length ? (
            methods.data.map((m) => (
              <Card key={m.publicId} padded style={styles.method}>
                <Icon name="coins" size={20} color={t.colors.green900} />
                <Text variant="body" style={styles.flex}>
                  {m.brand.toUpperCase()} •••• {m.last4}
                </Text>
                {m.isDefault ? <Pill label="Əsas" tone="green" /> : null}
              </Card>
            ))
          ) : (
            <Card padded style={styles.method}>
              <Icon name="info" size={20} color={t.colors.brown700} />
              <Text variant="small" color="ink2" style={styles.flex}>
                Kart əlavə edilməyib — test rejimində ödəniş mock provayderlə keçir.
              </Text>
            </Card>
          )}
        </View>

        {error ? (
          <Text variant="small" color="danger" center>
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

/** Boş tarixlər — API-dən gələn slotlar. */
function SlotPicker({
  slug,
  selected,
  onSelect,
}: {
  slug: string;
  selected?: number;
  onSelect: (id: number) => void;
}) {
  const slots = useAvailability(slug);

  if (slots.isLoading) return <Loading />;
  if (!slots.data?.slots.length) {
    return <Text variant="meta">Boş tarix yoxdur</Text>;
  }

  return (
    <View style={styles.slots}>
      {slots.data.slots.map((s) => {
        const active = selected === s.slotId;
        const date = new Date(s.startAt);
        return (
          <Pressable
            key={s.slotId}
            onPress={() => onSelect(s.slotId)}
            disabled={s.isFull}
            style={[styles.slot, active && styles.slotActive, s.isFull && styles.slotFull]}
          >
            <Text variant="h3" color={active ? 'paper' : 'ink'}>
              {date.getDate()}
            </Text>
            <Text variant="caption" color={active ? 'paper' : 'muted'}>
              {date.toLocaleDateString('az-AZ', { month: 'short' })}
            </Text>
            <Text variant="caption" color={active ? 'paper' : 'muted'}>
              {s.isFull ? 'dolu' : `${s.seatsLeft} yer`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <View style={styles.flex}>
        <Text variant="body">{label}</Text>
        <Text variant="caption">{hint}</Text>
      </View>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          style={[styles.stepBtn, value <= min && styles.stepBtnOff]}
          disabled={value <= min}
        >
          <Icon name="minus" size={14} color={value <= min ? t.colors.muted : t.colors.green900} strokeWidth={2.4} />
        </Pressable>
        <Text variant="h3" style={styles.stepValue}>
          {value}
        </Text>
        <Pressable onPress={() => onChange(Math.min(20, value + 1))} style={styles.stepBtn}>
          <Icon name="plus" size={14} color={t.colors.green900} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.xl },
  summary: { gap: 4 },
  sectionTitle: { marginBottom: t.spacing.md },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  slot: {
    width: 66, paddingVertical: t.spacing.md, alignItems: 'center', gap: 1,
    borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line,
    backgroundColor: t.colors.paper,
  },
  slotActive: { backgroundColor: t.colors.green900, borderColor: t.colors.green900 },
  slotFull: { opacity: 0.45 },
  stepper: { flexDirection: 'row', alignItems: 'center', paddingVertical: t.spacing.md },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnOff: { backgroundColor: t.colors.bg2 },
  stepValue: { minWidth: 20, textAlign: 'center' },
  price: { gap: t.spacing.sm },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  total: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: t.colors.line, paddingTop: t.spacing.md, marginTop: 4,
  },
  method: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  flex: { flex: 1, minWidth: 0 },
  ctaButton: { width: '100%' },
});
