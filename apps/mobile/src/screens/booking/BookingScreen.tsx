import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Icon, Loading, Pill, Screen, Text, TopBar } from '@/components';
import { useAvailability, useQuote, type Slot } from '@/api/hooks/booking';
import { useExperienceDetail } from '@/api/hooks/details';
import { useT } from '@/i18n';
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
  const { t: tr, tp: tpr } = useT('booking');
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
    ? tr('experience.hintPickDate')
    : slotFull
      ? tr('experience.hintSlotFull')
      : !cardId
        ? tr('shared.hintPickCard')
        : !quoteReady
          ? tr('shared.hintCalculating')
          : null;
  const error = checkout.error ?? (quote.error ? errorText(quote.error) : null);

  if (detail.isLoading) return <Loading label={tr('common:states.loading')} />;

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
            label={quote.data ? tr('shared.payAndBook', { total: quote.data.totalAzn }) : tr('shared.book')}
            onPress={pay}
            loading={checkout.busy}
            disabled={!slot || slotFull || !cardId || !quoteReady}
          />
        )
      }
    >
      <TopBar title={tr('shared.title')} onBack={navigation.goBack} />

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
                {tr('experience.pricePerPerson', { price: detail.data.pricing.priceAzn })}
              </Text>
              <Pill label={`+${detail.data.gezginRewards.bookingXp} XP`} tone="teal" />
            </View>
          </Card>
        ) : null}

        {/* Tarix seçimi — ekran 18 date strip, vaxtlar Bakı saatı ilə */}
        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            {tr('experience.pickDate')}
          </Text>
          {availability.isLoading ? (
            <Loading />
          ) : availability.isError ? (
            <Text variant="meta" color="danger">
              {tr('experience.slotsFailed', { error: errorText(availability.error) })}
            </Text>
          ) : !slots.length ? (
            <Text variant="meta">{tr('experience.noSlots')}</Text>
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
                {tr('experience.slotInfo', {
                  weekday: bakuWeekday(slot.startAt),
                  date: bakuDate(slot.startAt),
                  time: bakuTime(slot.startAt),
                })}{' '}
                <Text variant="caption" color={slotFull ? 'danger' : 'green900'} style={styles.bold}>
                  {slotFull ? tr('experience.soldOut') : tpr('experience.seatsLeft', seatsLeft)}
                </Text>
              </Text>
            </View>
          ) : null}
        </View>

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            {tr('experience.partySize')}
          </Text>
          <Stepper
            label={tr('shared.adults')}
            hint={tr('shared.adultsHint')}
            value={adults}
            min={1}
            max={Math.max(1, cap - children)}
            onChange={setAdults}
          />
          <Stepper
            label={tr('experience.children')}
            hint={tr('experience.childrenHint')}
            value={children}
            min={0}
            max={Math.max(0, cap - adults)}
            onChange={setChildren}
          />
          {seatsLeft !== undefined && !slotFull && adults + children >= cap ? (
            <Text variant="caption" color="brown700">
              {tpr('experience.capReached', seatsLeft)}
            </Text>
          ) : null}
        </View>

        {quote.data ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              {tr('shared.price')}
            </Text>
            <Card padded style={styles.price}>
              {quote.data.lines.map((line) => (
                <PriceRow key={line.code} label={`${line.label} × ${line.quantity}`} value={`${line.totalAzn} AZN`} />
              ))}
              {quote.data.serviceFeeAzn > 0 ? (
                <PriceRow label={tr('shared.serviceFee')} value={`${quote.data.serviceFeeAzn} AZN`} />
              ) : null}
              <View style={styles.total}>
                <PriceRow label={tr('shared.total')} value={`${quote.data.totalAzn} AZN`} strong />
              </View>
            </Card>
          </View>
        ) : quote.isLoading ? (
          <Loading />
        ) : null}

        {!isGuest ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              {tr('shared.paymentMethod')}
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
  const { t: tr, tp: tpr } = useT('booking');
  const full = seatsLeft <= 0;
  const seats = full ? tr('experience.slotFull') : tpr('experience.seats', seatsLeft);
  const fg = active ? 'paper' : 'muted';
  return (
    <Pressable
      onPress={onPress}
      disabled={full}
      accessibilityRole="radio"
      accessibilityLabel={tr('experience.slotA11y', { date: bakuDate(slot.startAt), time: bakuTime(slot.startAt), seats })}
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
