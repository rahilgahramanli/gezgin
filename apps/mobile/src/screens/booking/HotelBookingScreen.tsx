import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BOOKING_EXTRAS } from '@gezgin/shared';
import { Card, Icon, Loading, Photo, Pill, Screen, Text, TopBar } from '@/components';
import { useQuote, type QuoteInput } from '@/api/hooks/booking';
import { useBusiness } from '@/api/hooks/business';
import { useT } from '@/i18n';
import { AMENITY_LABEL, label } from '@/lib/labels';
import { bakuDate, bakuDayAt, bakuDayKey, bakuParts, bakuShortDate, bakuWeekday, monthShort } from '@/lib/time';
import { useIsGuest } from '@/store/auth';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import {
  CheckoutFooter, CheckoutOtp, GuestGate, PaymentPicker, PriceRow, Stepper, errorText, useCheckout,
} from './parts';

/** Otel paketində əlavələr rezervasiya başınadır (nəfər başına deyil). */
const HOTEL_EXTRAS = ['spa', 'transfer'] as const;

/** Giriş tarixi seçimləri — bu gündən neçə gün sonra. */
const START_OPTIONS = [0, 7, 14, 30] as const;

/** Giriş saatı, Bakı vaxtı ilə. */
const CHECK_IN_HOUR = 14;
const DAY_MS = 86_400_000;

/**
 * Göndəriləcək giriş vaxtı — TOXUNUŞ ANINDA hesablanır. Əvvəl ekran açılanda
 * bir dəfə hesablanırdı: "bu gün" seçilib bir müddət gözlənəndə vaxt keçmişdə
 * qalırdı və server "Keçmiş tarixə rezervasiya edilə bilməz" qaytarırdı.
 * Bu gün saat 14:00 artıq keçibsə giriş indidən 10 dəqiqə sonraya yazılır.
 */
function checkInAt(days: number, now = Date.now()): string {
  return new Date(Math.max(bakuDayAt(days, CHECK_IN_HOUR, now), now + 10 * 60_000)).toISOString();
}

/** Ekran 49 — otel/qonaq evi paket rezervasiyası. */
export function HotelBookingScreen({ route, navigation }: AppScreenProps<'HotelBooking'>) {
  const { business: slug, package: initialPackage } = route.params;
  const { t: tr, tp: tpr } = useT('booking');
  const isGuest = useIsGuest();

  const business = useBusiness(slug);
  const packages = business.data?.packages ?? [];

  const [selected, setSelected] = useState<string | undefined>(initialPackage);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [startsIn, setStartsIn] = useState<number>(7);
  const [extras, setExtras] = useState<string[]>([]);
  const [cardId, setCardId] = useState<string | null>(null);

  // Biznes yüklənəndə ilk paketi seçirik — ekran heç vaxt paketsiz qalmır
  const pkg = packages.find((p) => p.publicId === selected) ?? packages[0];

  // Qiymət hesabı üçün sabit giriş vaxtı (Bakı günü dəyişəndə yenilənir) — sorğu açarı hər renderdə dəyişməsin
  const today = bakuDayKey(Date.now());
  const displayCheckIn = bakuDayAt(startsIn, CHECK_IN_HOUR);
  const quoteInput: QuoteInput | null =
    pkg && !isGuest
      ? {
          type: 'business_package',
          target: pkg.publicId,
          adults,
          children,
          startAt: new Date(displayCheckIn).toISOString(),
          extras,
        }
      : null;
  const quote = useQuote(quoteInput);

  const checkout = useCheckout({
    onConfirmed: (publicId) => navigation.replace('BookingSuccess', { publicId }),
  });

  // Gecə sayı quote-dan gəlir — paket dəyişəndə çıxış tarixi də dəyişir
  const nights = quote.data?.nights ?? pkg?.nights ?? 0;
  const checkOut = displayCheckIn + nights * DAY_MS;

  const pay = () => {
    if (!pkg || !cardId) return;
    const input: QuoteInput = {
      type: 'business_package',
      target: pkg.publicId,
      adults,
      children,
      startAt: checkInAt(startsIn),
      extras,
    };
    // İmza günə bağlıdır, dəqiqəyə yox — təkrar cəhd eyni rezervasiyanı ödəsin
    const signature = JSON.stringify({ pkg: pkg.publicId, adults, children, startsIn, today, extras });
    void checkout.submit(input, cardId, signature);
  };

  if (business.isLoading) return <Loading label={tr('common:states.loading')} />;
  if (!business.data) return null;

  const quoteReady = !!quote.data && !quote.isPlaceholderData;
  const hint = !pkg
    ? tr('hotel.hintNoPackages')
    : !cardId
      ? tr('shared.hintPickCard')
      : !quoteReady
        ? tr('shared.hintCalculating')
        : null;
  const error = checkout.error ?? (quote.error ? errorText(quote.error) : null);

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
            disabled={!pkg || !cardId || !quoteReady}
          />
        )
      }
    >
      <TopBar title={tr('shared.title')} onBack={navigation.goBack} />

      <View style={styles.body}>
        <Card padded style={styles.summary}>
          <View style={styles.summaryRow}>
            <Photo uri={business.data.coverUrl} style={styles.summaryPhoto} radius={t.radius.md} />
            <View style={styles.flex}>
              <Text variant="h3" numberOfLines={1}>
                {business.data.name}
              </Text>
              <Text variant="caption" numberOfLines={2}>
                {pkg?.title ?? tr('hotel.noPackageSelected')}
              </Text>
              {pkg ? (
                <Text variant="h3" color="green900" style={styles.summaryPrice}>
                  {tpr('hotel.pricePerNights', pkg.nights, { replace: { price: pkg.priceAzn } })}
                </Text>
              ) : null}
            </View>
          </View>
          {quote.data ? <Pill label={`+${quote.data.rewards.bookingXp} XP`} tone="brown" /> : null}
        </Card>

        {/* Tarixlər — giriş seçilir, çıxış paketin gecə sayından çıxır. Hamısı Bakı təqvimi ilə */}
        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            {tr('hotel.dates')}
          </Text>
          <View style={styles.dateRow}>
            {START_OPTIONS.map((days) => {
              const at = bakuDayAt(days, CHECK_IN_HOUR);
              const p = bakuParts(at);
              const active = startsIn === days;
              return (
                <Pressable
                  key={days}
                  onPress={() => setStartsIn(days)}
                  accessibilityRole="radio"
                  accessibilityLabel={tr('hotel.checkInA11y', { date: bakuDate(at) })}
                  accessibilityState={{ checked: active }}
                  style={[styles.date, active && styles.dateActive]}
                >
                  <Text variant="caption" color={active ? 'paper' : 'muted'}>
                    {days === 0 ? tr('common:time.today') : bakuWeekday(at)}
                  </Text>
                  <Text variant="h3" color={active ? 'paper' : 'ink'}>
                    {p.day}
                  </Text>
                  <Text variant="caption" color={active ? 'paper' : 'muted'}>
                    {monthShort(p.month)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {nights > 0 ? (
            <View style={styles.stayRow}>
              <Icon name="calendar" size={15} color={t.colors.muted} />
              <Text variant="caption" style={styles.flex}>
                {tpr('hotel.stay', nights, {
                  replace: { checkIn: bakuShortDate(displayCheckIn), hour: CHECK_IN_HOUR, checkOut: bakuDate(checkOut) },
                })}
              </Text>
            </View>
          ) : null}
        </View>

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            {tr('hotel.guests')}
          </Text>
          <Stepper
            label={tr('shared.adults')}
            hint={tr('shared.adultsHint')}
            value={adults}
            min={1}
            max={20}
            onChange={setAdults}
          />
          <Stepper
            label={tr('hotel.children')}
            hint={tr('hotel.childrenHint')}
            value={children}
            min={0}
            max={20}
            onChange={setChildren}
          />
        </View>

        {packages.length ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              {tr('hotel.packages')}
            </Text>
            {packages.map((p) => {
              const active = p.publicId === pkg?.publicId;
              return (
                <Pressable
                  key={p.publicId}
                  onPress={() => setSelected(p.publicId)}
                  accessibilityRole="radio"
                  accessibilityLabel={tr('hotel.packageA11y', { title: p.title, price: p.priceAzn })}
                  accessibilityState={{ checked: active }}
                >
                  <Card padded style={[styles.option, active && styles.optionActive]}>
                    <View style={[styles.radio, active && styles.radioOn]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Text variant="h3" numberOfLines={1}>
                        {p.title}
                      </Text>
                      <Text variant="caption" numberOfLines={1}>
                        {tpr('shared.nights', p.nights)} / {tpr('shared.days', p.days)}
                        {p.includes.length ? ` · ${p.includes.map((i) => label(AMENITY_LABEL, i)).join(', ')}` : ''}
                      </Text>
                    </View>
                    <Text variant="h3" color="green900">
                      {p.priceAzn} AZN
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Card padded style={styles.notice}>
            <Icon name="info" size={20} color={t.colors.brown700} />
            <Text variant="small" color="ink2" style={styles.flex}>
              {tr('hotel.noPackages')}
            </Text>
          </Card>
        )}

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            {tr('hotel.extras')}
          </Text>
          {HOTEL_EXTRAS.map((code) => {
            const extra = BOOKING_EXTRAS[code];
            // Ad və izah tətbiqin öz kataloqudur (API mətni deyil) — cari dildə
            const name = tr(`extras.${code}.name`, { defaultValue: extra.nameAz });
            const hintText = tr(`extras.${code}.hint`, { defaultValue: extra.hintAz });
            const on = extras.includes(code);
            return (
              <Pressable
                key={code}
                onPress={() => setExtras((v) => (on ? v.filter((c) => c !== code) : [...v, code]))}
                accessibilityRole="checkbox"
                accessibilityLabel={`${name}, +${extra.priceAzn} AZN`}
                accessibilityState={{ checked: on }}
              >
                <Card padded style={[styles.option, on && styles.optionActive]}>
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on ? <Icon name="check" size={13} color="#fff" strokeWidth={3} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text variant="h3">{name}</Text>
                    <Text variant="caption">{hintText}</Text>
                  </View>
                  <Text variant="h3" color="green900">
                    +{extra.priceAzn} AZN
                  </Text>
                </Card>
              </Pressable>
            );
          })}
        </View>

        {!isGuest ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              {tr('shared.paymentMethod')}
            </Text>
            <PaymentPicker selected={cardId} onSelect={setCardId} />
          </View>
        ) : null}

        {quote.data ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              {tr('shared.price')}
            </Text>
            <Card padded style={styles.price}>
              {quote.data.lines.map((line) => (
                <PriceRow
                  key={line.code}
                  label={`${line.label}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
                  value={`${line.totalAzn} AZN`}
                />
              ))}
              <PriceRow label={tr('shared.serviceFee')} value={`${quote.data.serviceFeeAzn} AZN`} />
              <View style={styles.total}>
                <PriceRow label={tr('shared.total')} value={`${quote.data.totalAzn} AZN`} strong />
              </View>
            </Card>
            <Text variant="caption" style={styles.xpNote}>
              {tr('hotel.xpNote', { xp: quote.data.rewards.bookingXp, region: business.data.region.name })}
            </Text>
          </View>
        ) : quote.isLoading ? (
          <Loading />
        ) : null}
      </View>

      <CheckoutOtp checkout={checkout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.xl },
  summary: { gap: t.spacing.md, alignItems: 'flex-start' },
  summaryRow: { flexDirection: 'row', gap: t.spacing.md, alignSelf: 'stretch' },
  summaryPhoto: { width: 72, height: 72, backgroundColor: t.colors.bg2 },
  summaryPrice: { marginTop: 2 },
  sectionTitle: { marginBottom: t.spacing.md },
  dateRow: { flexDirection: 'row', gap: t.spacing.sm },
  date: {
    flex: 1, alignItems: 'center', paddingVertical: t.spacing.md,
    borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line,
    backgroundColor: t.colors.paper,
  },
  dateActive: { backgroundColor: t.colors.green900, borderColor: t.colors.green900 },
  stayRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: t.spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.sm },
  optionActive: { borderColor: t.colors.green900, backgroundColor: t.colors.green050 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: t.colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: t.colors.green900 },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: t.colors.green900 },
  check: {
    width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: t.colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { borderColor: t.colors.green900, backgroundColor: t.colors.green900 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  price: { gap: t.spacing.sm },
  total: { borderTopWidth: 1, borderTopColor: t.colors.line, paddingTop: t.spacing.md, marginTop: 4 },
  xpNote: { marginTop: t.spacing.sm },
  flex: { flex: 1, minWidth: 0 },
});
