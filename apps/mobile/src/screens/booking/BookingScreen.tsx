import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Icon, Loading, Pill, Screen, Text, TopBar } from '@/components';
import { useAvailability, useQuote, type Slot } from '@/api/hooks/booking';
import { useExperienceDetail } from '@/api/hooks/details';
import { durationLabel } from '@/lib/labels';
import { bakuDate, bakuShortDate, bakuTime, bakuWeekday } from '@/lib/time';
import { useIsGuest } from '@/store/auth';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import {
  CheckoutFooter, CheckoutOtp, GuestGate, PaymentPicker, PriceRow, Stepper, errorText, useCheckout,
} from './parts';

/** API `children` üçün 20, ümumi qrup üçün ağlabatan hədd. */
const MAX_PARTY = 20;

/** Ekran 18 — rezervasiya: tarix, nəfər sayı, qiymət bölgüsü, ödəniş. */
export function BookingScreen({ route, navigation }: AppScreenProps<'Booking'>) {
  const { experience: slug } = route.params;
  const isGuest = useIsGuest();
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [slotId, setSlotId] = useState<number | undefined>();
  const [cardId, setCardId] = useState<string | null>(null);

  const detail = useExperienceDetail(slug);
  const availability = useAvailability(slug);
  const slots = availability.data?.slots ?? [];
  const slot = slots.find((s) => s.slotId === slotId);

  const checkout = useCheckout({
    onConfirmed: (publicId) => navigation.replace('BookingSuccess', { publicId }),
    onCapacityError: () => void availability.refetch(),
  });

  /**
   * Ödənişi alınmamış rezervasiyamız yerləri artıq tutub (server onları boş
   * yerdən çıxır). Həmin slot üçün onları geri əlavə edirik — əks halda kart
   * rədd olunandan sonra öz rezervasiyamız slotu "dolu" göstərərdi.
   */
  const held = (id: number | undefined) =>
    checkout.pending && id !== undefined && checkout.pending.slotId === id
      ? checkout.pending.adults + (checkout.pending.children ?? 0)
      : 0;
  const seatsLeft = slot ? slot.seatsLeft + held(slot.slotId) : undefined;

  // İlk boş tarix avtomatik seçilir. Seçilmiş tarix sonradan dolsa belə seçim
  // dəyişdirilmir — istifadəçi bilmədən başqa günə keçməsin; düymə səbəbi deyir.
  useEffect(() => {
    const list = availability.data?.slots ?? [];
    if (slotId !== undefined && list.some((s) => s.slotId === slotId)) return;
    setSlotId(list.find((s) => !s.isFull)?.slotId);
    // Yalnız slot siyahısı dəyişəndə — istifadəçinin seçimi hər renderdə sıfırlanmasın
  }, [availability.data]);

  const slotFull = seatsLeft !== undefined && seatsLeft <= 0;
  /**
   * Qrup seçilmiş tarixdəki boş yerdən böyük ola bilməz. Tarix tam dolubsa
   * nəfər sayı 1-ə endirilmir — istifadəçi başqa tarix seçəcək.
   */
  const cap = Math.max(1, Math.min(MAX_PARTY, (slotFull ? undefined : seatsLeft) ?? detail.data?.maxGroup ?? MAX_PARTY));
  useEffect(() => {
    if (adults + children <= cap) return;
    const a = Math.min(adults, cap);
    setAdults(a);
    setChildren(Math.max(0, Math.min(children, cap - a)));
    // Yalnız hədd dəyişəndə (başqa tarix seçildi və ya boş yer azaldı)
  }, [cap]);

  const quote = useQuote(isGuest ? null : { type: 'experience', target: slug, adults, children, slotId });

  const pay = () => {
    if (!slotId || !cardId) return;
    void checkout.submit({ type: 'experience', target: slug, adults, children, slotId }, cardId);
  };

  const quoteReady = !!quote.data && !quote.isPlaceholderData;
  const hint = !slot
    ? 'Ödəniş üçün əvvəlcə tarix seçin'
    : slotFull
      ? 'Bu tarixdə yer qalmayıb — başqa tarix seçin'
      : !cardId
        ? 'Ödəniş üçün kart seçin və ya əlavə edin'
        : !quoteReady
          ? 'Qiymət hesablanır…'
          : null;
  const error = checkout.error ?? (quote.error ? errorText(quote.error) : null);

  if (detail.isLoading) return <Loading label="Yüklənir…" />;

  return (
    <Screen
      padded={false}
      footer={
        isGuest ? (
          <GuestGate />
        ) : (
          <CheckoutFooter
            error={error}
            hint={hint}
            label={quote.data ? `${quote.data.totalAzn} AZN ödə və bron et` : 'Bron et'}
            onPress={pay}
            loading={checkout.busy}
            disabled={!slot || slotFull || !cardId || !quoteReady}
          />
        )
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
            <View style={styles.summaryRow}>
              <Text variant="h3" color="green900">
                {detail.data.pricing.priceAzn} AZN / nəfər
              </Text>
              <Pill label={`+${detail.data.gezginRewards.bookingXp} XP`} tone="teal" />
            </View>
          </Card>
        ) : null}

        {/* Tarix seçimi — ekran 18 date strip, vaxtlar Bakı saatı ilə */}
        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Tarix seç
          </Text>
          {availability.isLoading ? (
            <Loading />
          ) : availability.isError ? (
            <Text variant="meta" color="danger">
              Tarixlər yüklənmədi — {errorText(availability.error)}
            </Text>
          ) : !slots.length ? (
            <Text variant="meta">Bu təcrübə üçün hələ tarix açılmayıb</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slots}>
              {slots.map((s) => (
                <SlotChip
                  key={s.slotId}
                  slot={s}
                  seatsLeft={s.seatsLeft + held(s.slotId)}
                  active={s.slotId === slotId}
                  onPress={() => setSlotId(s.slotId)}
                />
              ))}
            </ScrollView>
          )}
          {slot && seatsLeft !== undefined ? (
            <View style={styles.slotInfo}>
              <Icon name="calendar" size={15} color={t.colors.muted} />
              <Text variant="caption" style={styles.flex}>
                {bakuWeekday(slot.startAt)}, {bakuDate(slot.startAt)} · başlama {bakuTime(slot.startAt)} ·{' '}
                <Text variant="caption" color={slotFull ? 'danger' : 'green900'} style={styles.bold}>
                  {slotFull ? 'yer qalmayıb' : `${seatsLeft} yer qalıb`}
                </Text>
              </Text>
            </View>
          ) : null}
        </View>

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Nəfər sayı
          </Text>
          <Stepper
            label="Böyük"
            hint="13 yaş və yuxarı"
            value={adults}
            min={1}
            max={Math.max(1, cap - children)}
            onChange={setAdults}
          />
          <Stepper
            label="Uşaq"
            hint="0–12 yaş · 50% endirim"
            value={children}
            min={0}
            max={Math.max(0, cap - adults)}
            onChange={setChildren}
          />
          {seatsLeft !== undefined && !slotFull && adults + children >= cap ? (
            <Text variant="caption" color="brown700">
              Seçilmiş tarixdə {seatsLeft} yer qalıb — daha çox nəfər üçün başqa tarix seçin.
            </Text>
          ) : null}
        </View>

        {quote.data ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              Qiymət
            </Text>
            <Card padded style={styles.price}>
              {quote.data.lines.map((line) => (
                <PriceRow key={line.code} label={`${line.label} × ${line.quantity}`} value={`${line.totalAzn} AZN`} />
              ))}
              {quote.data.serviceFeeAzn > 0 ? (
                <PriceRow label="Xidmət haqqı" value={`${quote.data.serviceFeeAzn} AZN`} />
              ) : null}
              <View style={styles.total}>
                <PriceRow label="Cəmi" value={`${quote.data.totalAzn} AZN`} strong />
              </View>
            </Card>
          </View>
        ) : quote.isLoading ? (
          <Loading />
        ) : null}

        {!isGuest ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              Ödəniş üsulu
            </Text>
            <PaymentPicker selected={cardId} onSelect={setCardId} />
          </View>
        ) : null}
      </View>

      <CheckoutOtp checkout={checkout} />
    </Screen>
  );
}

/** Tarix çipi: həftə günü + tarix, başlama saatı və boş yer — eyni gündə bir neçə slot seçilə bilsin. */
function SlotChip({
  slot,
  seatsLeft,
  active,
  onPress,
}: {
  slot: Slot;
  /** Öz ödənilməmiş rezervasiyamızın tutduğu yerlər daxil. */
  seatsLeft: number;
  active: boolean;
  onPress: () => void;
}) {
  const full = seatsLeft <= 0;
  const seats = full ? 'dolu' : `${seatsLeft} yer`;
  const fg = active ? 'paper' : 'muted';
  return (
    <Pressable
      onPress={onPress}
      disabled={full}
      accessibilityRole="radio"
      accessibilityLabel={`Tarix ${bakuDate(slot.startAt)}, ${bakuTime(slot.startAt)}, ${seats}`}
      accessibilityState={{ checked: active, disabled: full }}
      style={[styles.slot, active && styles.slotActive, full && styles.slotFull]}
    >
      <Text variant="caption" color={fg}>
        {bakuWeekday(slot.startAt)}, {bakuShortDate(slot.startAt)}
      </Text>
      <Text variant="h3" color={active ? 'paper' : 'ink'}>
        {bakuTime(slot.startAt)}
      </Text>
      <Text variant="caption" color={full && !active ? 'danger' : fg} style={styles.bold}>
        {seats}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.xl },
  summary: { gap: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { marginBottom: t.spacing.md },
  slots: { gap: t.spacing.sm, paddingRight: t.spacing.page },
  slot: {
    minWidth: 84, paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.sm, alignItems: 'center', gap: 2,
    borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line,
    backgroundColor: t.colors.paper,
  },
  slotActive: { backgroundColor: t.colors.green900, borderColor: t.colors.green900 },
  slotFull: { opacity: 0.45 },
  slotInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: t.spacing.sm },
  bold: { fontWeight: '700' },
  price: { gap: t.spacing.sm },
  total: { borderTopWidth: 1, borderTopColor: t.colors.line, paddingTop: t.spacing.md, marginTop: 4 },
  flex: { flex: 1, minWidth: 0 },
});
