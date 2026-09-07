import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BOOKING_EXTRAS } from '@gezgin/shared';
import {
  Button, Card, Icon, Loading, Photo, Pill, Screen, Text, TopBar,
} from '@/components';
import { useAddCard, useCreateBooking, usePaymentMethods, usePayBooking, useQuote } from '@/api/hooks/booking';
import { useBusiness } from '@/api/hooks/business';
import { ApiError } from '@/api/client';
import { AMENITY_LABEL, label } from '@/lib/labels';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Otel paketində əlavələr rezervasiya başınadır (nəfər başına deyil). */
const HOTEL_EXTRAS = ['spa', 'transfer'] as const;

const fmtDate = (d: Date): string =>
  d.toLocaleDateString('az-AZ', { day: 'numeric', month: 'long' });

/** Ekran 49 — otel/qonaq evi paket rezervasiyası. */
export function HotelBookingScreen({ route, navigation }: AppScreenProps<'HotelBooking'>) {
  const { business: slug, package: initialPackage } = route.params;

  const business = useBusiness(slug);
  const packages = business.data?.packages ?? [];

  const [selected, setSelected] = useState<string | undefined>(initialPackage);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [startsIn, setStartsIn] = useState(7);
  const [extras, setExtras] = useState<string[]>([]);

  // Biznes yüklənəndə ilk paketi seçirik — ekran heç vaxt paketsiz qalmır
  const pkg = packages.find((p) => p.publicId === selected) ?? packages[0];
  const startDate = useMemo(() => new Date(Date.now() + startsIn * 86400_000), [startsIn]);

  const quote = useQuote(
    pkg
      ? {
          type: 'business_package',
          target: pkg.publicId,
          adults,
          children,
          startAt: startDate.toISOString(),
          extras,
        }
      : null,
  );

  const methods = usePaymentMethods();
  const createBooking = useCreateBooking();
  const pay = usePayBooking();
  const addCard = useAddCard();

  const busy = createBooking.isPending || pay.isPending || addCard.isPending;
  const error = [createBooking.error, pay.error, quote.error].find((e) => e instanceof ApiError) as
    | ApiError
    | undefined;

  // Gecə sayı quote-dan gəlir — paket dəyişəndə çıxış tarixi də dəyişir
  const nights = quote.data?.nights ?? pkg?.nights ?? 0;
  const endDate = new Date(startDate.getTime() + nights * 86400_000);

  const confirm = async () => {
    if (!pkg) return;
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
      {
        type: 'business_package',
        target: pkg.publicId,
        adults,
        children,
        startAt: startDate.toISOString(),
        extras,
      },
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

  if (business.isLoading) return <Loading label="Yüklənir…" />;
  if (!business.data) return null;

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

        {/* Tarixlər — giriş seçilir, çıxış paketin gecə sayından çıxır */}
        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Tarixlər
          </Text>
          <View style={styles.dateRow}>
            {[0, 7, 14, 30].map((days) => {
              const d = new Date(Date.now() + days * 86400_000);
              const active = startsIn === days;
              return (
                <Pressable
                  key={days}
                  onPress={() => setStartsIn(days)}
                  style={[styles.date, active && styles.dateActive]}
                >
                  <Text variant="h3" color={active ? 'paper' : 'ink'}>
                    {d.getDate()}
                  </Text>
                  <Text variant="caption" color={active ? 'paper' : 'muted'}>
                    {d.toLocaleDateString('az-AZ', { month: 'short' })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {nights > 0 ? (
            <View style={styles.stayRow}>
              <Icon name="calendar" size={15} color={t.colors.muted} />
              <Text variant="caption">
                Giriş {fmtDate(startDate)} · Çıxış {fmtDate(endDate)} · {nights} gecə
              </Text>
            </View>
          ) : null}
        </View>

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Qonaqlar
          </Text>
          <Stepper label="Böyük" hint="13 yaş və yuxarı" value={adults} min={1} onChange={setAdults} />
          <Stepper label="Uşaq (0–12)" hint="Valideynlə pulsuz" value={children} min={0} onChange={setChildren} />
        </View>

        {packages.length ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              Otaq və paket
            </Text>
            {packages.map((p) => {
              const active = p.publicId === pkg?.publicId;
              return (
                <Pressable key={p.publicId} onPress={() => setSelected(p.publicId)}>
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

        {quote.data ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              Qiymət
            </Text>
            <Card padded style={styles.price}>
              {quote.data.lines.map((line) => (
                <View key={line.code} style={styles.priceRow}>
                  <Text variant="body" color="ink2" style={styles.flex}>
                    {line.label}
                    {line.quantity > 1 ? ` × ${line.quantity}` : ''}
                  </Text>
                  <Text variant="body">{line.totalAzn} AZN</Text>
                </View>
              ))}
              <View style={styles.priceRow}>
                <Text variant="body" color="ink2">
                  Xidmət haqqı
                </Text>
                <Text variant="body">{quote.data.serviceFeeAzn} AZN</Text>
              </View>
              <View style={styles.total}>
                <Text variant="h3">Cəmi</Text>
                <Text variant="h2" color="green900">
                  {quote.data.totalAzn} AZN
                </Text>
              </View>
            </Card>
            <Text variant="caption" style={styles.xpNote}>
              Bu rezervasiya ilə +{quote.data.rewards.bookingXp} XP · {business.data.region.name} regionu
            </Text>
          </View>
        ) : quote.isLoading ? (
          <Loading />
        ) : null}

        {error ? (
          <Text variant="small" color="danger" center>
            {error.message}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function Stepper({
  label: name,
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
        <Text variant="body">{name}</Text>
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
  stepper: { flexDirection: 'row', alignItems: 'center', paddingVertical: t.spacing.md },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnOff: { backgroundColor: t.colors.bg2 },
  stepValue: { minWidth: 20, textAlign: 'center' },
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
  method: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  price: { gap: t.spacing.sm },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.md },
  total: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: t.colors.line, paddingTop: t.spacing.md, marginTop: 4,
  },
  xpNote: { marginTop: t.spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  ctaButton: { width: '100%' },
});
