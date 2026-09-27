import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Card, EmptyState, Icon, Loading, Photo, Pill, Screen, Text, TopBar } from '@/components';
import { useBooking, useCancelBooking, useTicket, type Booking } from '@/api/hooks/booking';
import { bakuDate, bakuTime } from '@/lib/time';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import {
  CheckoutFooter, CheckoutOtp, ErrorNotice, PAYMENT_STATUS, PaymentPicker, PriceRow, bookingStatus, errorText,
  guestsLabel, isPayable, refundPreview, timeLeftLabel, useCheckout,
} from './parts';

/**
 * Rezervasiya detalı (ekran 53 → kart): status, Bakı vaxtı ilə tarix, qiymət,
 * ödəniş, ləğv siyasəti və bilet. Ödənilməmiş rezervasiya burada tamamlanır
 * (eyni kart seçimi + 3-D Secure axını), təsdiqlənmiş rezervasiya ləğv edilir.
 */
export function BookingDetailScreen({ route, navigation }: AppScreenProps<'BookingDetail'>) {
  const { publicId } = route.params;
  const booking = useBooking(publicId);

  if (booking.isLoading) return <Loading label="Yüklənir…" />;
  if (!booking.data) {
    return (
      <Screen padded={false}>
        <TopBar title="Rezervasiya" onBack={navigation.goBack} />
        <EmptyState
          icon="info"
          title="Rezervasiya açılmadı"
          message={errorText(booking.error)}
          action={<Button label="Yenidən yüklə" variant="soft" onPress={() => void booking.refetch()} />}
        />
      </Screen>
    );
  }

  return <BookingDetailBody booking={booking.data} onBack={navigation.goBack} />;
}

function BookingDetailBody({ booking: b, onBack }: { booking: Booking; onBack: () => void }) {
  const st = bookingStatus(b.status);
  const payable = isPayable(b);
  const hasTicket = b.status === 'confirmed' || b.status === 'completed';
  const ticket = useTicket(b.publicId, hasTicket);
  const cancel = useCancelBooking();
  const [cardId, setCardId] = useState<string | null>(null);

  const checkout = useCheckout({
    bookingId: b.publicId,
    // Detal və siyahılar `usePayBooking` tərəfindən invalidate olunur — status yerindəcə yenilənir
    onConfirmed: () => Alert.alert('Ödəniş tamamlandı', 'Rezervasiya təsdiqləndi — bilet aşağıdadır.'),
  });

  const confirmCancel = () => {
    const refund = refundPreview(b);
    const paid = b.payment && (b.payment.status === 'succeeded' || b.payment.status === 'partially_refunded');
    const refundLine = !paid
      ? 'Ödəniş edilməyib — kartınızdan heç bir məbləğ çıxılmayıb.'
      : refund.amountAzn > 0
        ? `${refund.amountAzn} AZN geri qaytarılacaq (${refund.percent}%).`
        : 'Ləğv siyasətinə görə geri qaytarma yoxdur.';
    Alert.alert('Rezervasiyanı ləğv etmək?', `${b.cancellation.label}\n\n${refundLine}`, [
      { text: 'İmtina', style: 'cancel' },
      {
        text: 'Ləğv et',
        style: 'destructive',
        onPress: () =>
          cancel.mutate(
            { publicId: b.publicId },
            {
              onSuccess: (res) =>
                Alert.alert(
                  'Rezervasiya ləğv edildi',
                  res.refund.refunded
                    ? `${res.refund.amountAzn} AZN kartınıza qaytarıldı (${res.policy.refundPercent}%).`
                    : paid
                      ? 'Ləğv siyasətinə görə geri qaytarma yoxdur.'
                      : 'Ödəniş edilmədiyi üçün geri qaytarma tələb olunmur.',
                ),
            },
          ),
      },
    ]);
  };

  const payHint = !cardId ? 'Ödəniş üçün kart seçin və ya əlavə edin' : null;

  return (
    <Screen
      padded={false}
      footer={
        payable ? (
          <CheckoutFooter
            error={checkout.error}
            hint={payHint}
            label={`Ödənişi tamamla · ${b.pricing.totalAzn} AZN`}
            onPress={() => cardId && void checkout.payExisting(cardId)}
            loading={checkout.busy}
            disabled={!cardId}
          />
        ) : undefined
      }
    >
      <TopBar title="Rezervasiya" onBack={onBack} />

      <View style={styles.body}>
        <Card padded style={styles.head}>
          <View style={styles.headRow}>
            <Photo uri={b.imageUrl} style={styles.thumb} radius={t.radius.md} />
            <View style={styles.flex}>
              <Text variant="h3" numberOfLines={2}>
                {b.title}
              </Text>
              {b.subtitle ? (
                <Text variant="caption" numberOfLines={1}>
                  {b.subtitle}
                </Text>
              ) : null}
              <Pill label={st.label} tone={st.tone} style={styles.pill} />
            </View>
          </View>

          <View style={styles.rows}>
            {b.endAt ? (
              <>
                <InfoRow label="Giriş" value={b.startAt ? `${bakuDate(b.startAt)}, ${bakuTime(b.startAt)}` : '—'} />
                <InfoRow label="Çıxış" value={bakuDate(b.endAt)} />
              </>
            ) : (
              <>
                <InfoRow label="Tarix" value={b.startAt ? bakuDate(b.startAt) : 'Tarixsiz'} />
                <InfoRow label="Vaxt" value={b.startAt ? `${bakuTime(b.startAt)} (Bakı vaxtı)` : '—'} />
              </>
            )}
            <InfoRow label="Nəfər" value={guestsLabel(b)} />
            <InfoRow label="Bron kodu" value={b.code} />
          </View>
        </Card>

        {/* Bilet — yalnız təsdiqlənmiş və tamamlanmış rezervasiya üçün */}
        {hasTicket ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              Bilet
            </Text>
            <Card padded style={styles.ticket}>
              {ticket.isLoading ? (
                <Loading />
              ) : ticket.data ? (
                <>
                  <Text variant="caption">Bron kodu</Text>
                  <Text
                    variant="titleXl"
                    color="green900"
                    style={styles.code}
                    accessibilityLabel={`Bilet kodu ${ticket.data.code}`}
                  >
                    {ticket.data.code}
                  </Text>
                  <View style={styles.qr}>
                    <Text variant="caption" color="muted">
                      QR məlumatı
                    </Text>
                    <Text variant="small" selectable style={styles.mono}>
                      {ticket.data.qrPayload}
                    </Text>
                  </View>
                  <Text variant="caption" center>
                    Girişdə bu kodu göstər
                  </Text>
                </>
              ) : (
                <View style={styles.ticketError}>
                  <Text variant="small" color="ink2" center>
                    Bilet yüklənmədi — {errorText(ticket.error)}
                  </Text>
                  <Button label="Yenidən yüklə" size="sm" variant="soft" onPress={() => void ticket.refetch()} />
                </View>
              )}
            </Card>
          </View>
        ) : null}

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Qiymət
          </Text>
          <Card padded style={styles.price}>
            {b.pricing.lines.map((line) => (
              <PriceRow
                key={line.code}
                label={`${line.label}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
                value={`${line.totalAzn} AZN`}
              />
            ))}
            {b.pricing.serviceFeeAzn > 0 ? (
              <PriceRow label="Xidmət haqqı" value={`${b.pricing.serviceFeeAzn} AZN`} />
            ) : null}
            <View style={styles.total}>
              <PriceRow label="Cəmi" value={`${b.pricing.totalAzn} AZN`} strong />
            </View>
          </Card>
        </View>

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Ödəniş
          </Text>
          <Card padded style={styles.rows}>
            {b.payment ? (
              <>
                <InfoRow label="Status" value={PAYMENT_STATUS[b.payment.status] ?? b.payment.status} />
                <InfoRow label="Məbləğ" value={`${b.payment.amountAzn} AZN`} />
                {b.payment.refundedAzn > 0 ? (
                  <InfoRow label="Geri qaytarılıb" value={`${b.payment.refundedAzn} AZN`} />
                ) : null}
                {b.payment.paidAt ? (
                  <InfoRow label="Ödəniş tarixi" value={`${bakuDate(b.payment.paidAt)}, ${bakuTime(b.payment.paidAt)}`} />
                ) : null}
                {b.payment.status === 'failed' && b.payment.failureMessage ? (
                  <Text variant="small" color="danger">
                    Son cəhd: {b.payment.failureMessage}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text variant="small" color="ink2">
                Ödəniş hələ edilməyib.
              </Text>
            )}
          </Card>
        </View>

        {payable ? (
          <View>
            <Text variant="h2" style={styles.sectionTitle}>
              Ödəniş üsulu
            </Text>
            <Text variant="caption" style={styles.payNote}>
              Ödənilməmiş rezervasiya bir müddətdən sonra avtomatik ləğv olunur və yer boşalır.
            </Text>
            <PaymentPicker selected={cardId} onSelect={setCardId} />
          </View>
        ) : null}

        {/* Ləğv siyasəti — serverdən, başlanğıca qalan vaxta görə */}
        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            Ləğv siyasəti
          </Text>
          <Card padded style={styles.policy}>
            <Icon name="info" size={20} color={t.colors.brown700} />
            <View style={styles.flex}>
              <Text variant="body">{b.cancellation.label}</Text>
              <Text variant="caption">
                {timeLeftLabel(b.cancellation.hoursLeft)} · geri qaytarma {b.cancellation.refundPercent}%
              </Text>
            </View>
          </Card>
        </View>

        {cancel.error ? <ErrorNotice message={errorText(cancel.error)} /> : null}
        {/* Ödəniş xətası rezervasiyanı ödənilməz edibsə (məs. vaxtı bitib) alt panel gizlənir — xəta burada qalır */}
        {!payable && checkout.error ? <ErrorNotice message={checkout.error} /> : null}

        {b.cancellation.canCancel ? (
          <Button
            label="Rezervasiyanı ləğv et"
            variant="danger"
            onPress={confirmCancel}
            loading={cancel.isPending}
            disabled={checkout.busy}
            style={styles.wide}
          />
        ) : null}
      </View>

      <CheckoutOtp checkout={checkout} />
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text variant="meta">{label}</Text>
      <Text variant="body" style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.xl },
  head: { gap: t.spacing.lg },
  headRow: { flexDirection: 'row', gap: t.spacing.md },
  thumb: { width: 72, height: 72, backgroundColor: t.colors.bg2 },
  pill: { marginTop: 6 },
  rows: { gap: t.spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.spacing.md },
  infoValue: { fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  sectionTitle: { marginBottom: t.spacing.md },
  ticket: { alignItems: 'center', gap: t.spacing.sm },
  code: { letterSpacing: 3 },
  qr: {
    alignSelf: 'stretch', alignItems: 'center', gap: 2, padding: t.spacing.md,
    backgroundColor: t.colors.green050, borderRadius: t.radius.md,
  },
  mono: { textAlign: 'center', letterSpacing: 0.5 },
  ticketError: { alignItems: 'center', gap: t.spacing.md },
  price: { gap: t.spacing.sm },
  total: { borderTopWidth: 1, borderTopColor: t.colors.line, paddingTop: t.spacing.md, marginTop: 4 },
  payNote: { marginTop: -t.spacing.sm, marginBottom: t.spacing.md },
  policy: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'flex-start' },
  wide: { width: '100%' },
  flex: { flex: 1, minWidth: 0 },
});
