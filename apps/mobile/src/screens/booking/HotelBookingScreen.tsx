import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BOOKING_EXTRAS } from '@gezgin/shared';
import { Card, Icon, Loading, Photo, Pill, Screen, Text, TopBar } from '@/components';
import { useQuote, type QuoteInput } from '@/api/hooks/booking';
import { useBusiness } from '@/api/hooks/business';
import { AMENITY_LABEL, label } from '@/lib/labels';
import { bakuDate, bakuDayAt, bakuDayKey, bakuParts, bakuShortDate, bakuWeekday, AZ_MONTHS_SHORT } from '@/lib/time';
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

  if (business.isLoading) return <Loading label="Yüklənir…" />;
  if (!business.data) return null;

  const quoteReady = !!quote.data && !quote.isPlaceholderData;
  const hint = !pkg
    ? 'Bu obyektdə açıq paket yoxdur'
    : !cardId
      ? 'Ödəniş üçün kart seçin və ya əlavə edin'
      : !quoteReady
        ? 'Qiymət hesablanır…'
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
            label={quote.data ? `${quote.data.totalAzn} AZN ödə və bron et` : 'Bron et'}
            onPress={pay}
            loading={checkout.busy}
            disabled={!pkg || !cardId || !quoteReady}
          />
        )
      }
    >
      <TopBar title="Rezervasiya" onBack={navigation.goBack} />

      <View style={styles.body}>
        <Card padded style={styles.summary}>
          <View style={styles.summaryRow}>
            <Photo uri={business.data.coverUrl} style={styles.summaryPhoto} radius={t.radius.md} />
            <View style={styles.flex}>
              <Text variant="h3" numberOfLines={1}>
                {business.data.name}
              </Text>
              <Text variant="caption" numberOfLines={2}>
                {pkg?.title ?? 'Paket seçilməyib'}
              </Text>
              {pkg ? (
                <Text variant="h3" color="green900" style={styles.summaryPrice}>
                  {pkg.priceAzn} AZN / {pkg.nights} gecə
                </Text>
              ) : null}
            </View>
          </View>
          {quote.data ? <Pill label={`+${quote.data.rewards.bookingXp} XP`} tone="brown" /> : null}
        </Card>

        {/* Tarixlər — giriş seçilir, çıxış paketin gecə sayından çıxır. Hamısı Bakı təqvimi ilə */}
        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Tarixlər
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
                  accessibilityLabel={`Giriş ${bakuDate(at)}`}
                  accessibilityState={{ checked: active }}
                  style={[styles.date, active && styles.dateActive]}
                >
                  <Text variant="caption" color={active ? 'paper' : 'muted'}>
                    {days === 0 ? 'Bu gün' : bakuWeekday(at)}
                  </Text>
                  <Text variant="h3" color={active ? 'paper' : 'ink'}>
                    {p.day}
                  </Text>
                  <Text variant="caption" color={active ? 'paper' : 'muted'}>
                    {AZ_MONTHS_SHORT[p.month]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {nights > 0 ? (
            <View style={styles.stayRow}>
              <Icon name="calendar" size={15} color={t.colors.muted} />
              <Text variant="caption" style={styles.flex}>
                Giriş {bakuShortDate(displayCheckIn)} ({CHECK_IN_HOUR}:00-dan) · Çıxış {bakuDate(checkOut)} · {nights}{' '}
                gecə
              </Text>
            </View>
          ) : null}
        </View>

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Qonaqlar
          </Text>
          <Stepper label="Böyük" hint="13 yaş və yuxarı" value={adults} min={1} max={20} onChange={setAdults} />
          <Stepper label="Uşaq (0–12)" hint="Valideynlə pulsuz" value={children} min={0} max={20} onChange={setChildren} />
        </View>

        {packages.length ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              Otaq və paket
            </Text>
            {packages.map((p) => {
              const active = p.publicId === pkg?.publicId;
              return (
                <Pressable
                  key={p.publicId}
                  onPress={() => setSelected(p.publicId)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Paket ${p.title}, ${p.priceAzn} AZN`}
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
                        {p.nights} gecə / {p.days} gün
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
              Bu obyektdə hazırda açıq paket yoxdur.
            </Text>
          </Card>
        )}

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Əlavələr
          </Text>
          {HOTEL_EXTRAS.map((code) => {
            const extra = BOOKING_EXTRAS[code];
            const on = extras.includes(code);
            return (
              <Pressable
                key={code}
                onPress={() => setExtras((v) => (on ? v.filter((c) => c !== code) : [...v, code]))}
                accessibilityRole="checkbox"
                accessibilityLabel={`${extra.nameAz}, +${extra.priceAzn} AZN`}
                accessibilityState={{ checked: on }}
              >
                <Card padded style={[styles.option, on && styles.optionActive]}>
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on ? <Icon name="check" size={13} color="#fff" strokeWidth={3} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text variant="h3">{extra.nameAz}</Text>
                    <Text variant="caption">{extra.hintAz}</Text>
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
              Ödəniş üsulu
            </Text>
            <PaymentPicker selected={cardId} onSelect={setCardId} />
          </View>
        ) : null}

        {quote.data ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              Qiymət
            </Text>
            <Card padded style={styles.price}>
              {quote.data.lines.map((line) => (
                <PriceRow
                  key={line.code}
                  label={`${line.label}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
                  value={`${line.totalAzn} AZN`}
                />
              ))}
              <PriceRow label="Xidmət haqqı" value={`${quote.data.serviceFeeAzn} AZN`} />
              <View style={styles.total}>
                <PriceRow label="Cəmi" value={`${quote.data.totalAzn} AZN`} strong />
              </View>
            </Card>
            <Text variant="caption" style={styles.xpNote}>
              Bu rezervasiya ilə +{quote.data.rewards.bookingXp} XP · {business.data.region.name} regionu
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
