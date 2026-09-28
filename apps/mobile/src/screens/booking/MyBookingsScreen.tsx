import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, EmptyState, Icon, Loading, Photo, Pill, Screen, Text, TopBar } from '@/components';
import { useBookings, type BookingFilter, type BookingList } from '@/api/hooks/booking';
import { useT } from '@/i18n';
import { useIsGuest } from '@/store/auth';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';
import { GuestGate, bookingStatus, bookingWhen, errorText, isPayable } from './parts';

/** Tab açarları — mətn renderdə `booking:myBookings.tabs.<key>`-dan. */
const TABS: readonly BookingFilter[] = ['upcoming', 'past', 'cancelled'];

/** Ekran 53 — rezervasiyalarım. Kart toxunanda detal açılır (ləğv, bilet, ödəniş). */
export function MyBookingsScreen({ navigation }: AppScreenProps<'MyBookings'>) {
  const { t: tr, tp: tpr } = useT('booking');
  const isGuest = useIsGuest();
  const [tab, setTab] = useState<BookingFilter>('upcoming');
  const bookings = useBookings(tab, !isGuest);
  // Hər tabın cavabı üç sayğacın hamısını gətirir. Yeni tab yüklənənə qədər sonuncu
  // məlum sayğaclar qalır ki, çiplər "(2)" ↔ boş arasında sıçramasın; ləğvdən sonra
  // siyahılar invalidate olunur və sayğaclar serverdən təzə gəlir.
  const lastCounts = useRef<BookingList['counts'] | undefined>(undefined);
  if (bookings.data) lastCounts.current = bookings.data.counts;
  const counts = lastCounts.current;

  if (isGuest) {
    return (
      <Screen padded={false}>
        <TopBar title={tr('myBookings.title')} onBack={navigation.goBack} />
        <View style={styles.body}>
          <GuestGate message={tr('myBookings.guestMessage')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <TopBar title={tr('myBookings.title')} onBack={navigation.goBack} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {TABS.map((key) => {
          const label = tr(`myBookings.tabs.${key}`);
          return (
            <Chip
              key={key}
              label={counts ? `${label} (${counts[key]})` : label}
              active={tab === key}
              onPress={() => setTab(key)}
            />
          );
        })}
      </ScrollView>

      <View style={styles.body}>
        {bookings.isLoading ? (
          <Loading />
        ) : bookings.isError ? (
          <EmptyState
            icon="info"
            title={tr('common:states.failedTitle')}
            message={errorText(bookings.error)}
            action={<Button label={tr('shared.reload')} variant="soft" onPress={() => void bookings.refetch()} />}
          />
        ) : !bookings.data?.data.length ? (
          <EmptyState
            icon="calendar"
            title={tr('myBookings.emptyTitle')}
            message={tr('myBookings.emptyMessage')}
          />
        ) : (
          <View style={styles.list}>
            {bookings.data.data.map((b) => {
              const st = bookingStatus(b.status);
              const payable = isPayable(b);
              return (
                <Pressable
                  key={b.publicId}
                  onPress={() => navigation.navigate('BookingDetail', { publicId: b.publicId })}
                  accessibilityRole="button"
                  accessibilityLabel={tr('myBookings.cardA11y', { code: b.code, title: b.title, status: st.label })}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={styles.cardTop}>
                    <Photo uri={b.imageUrl} style={styles.thumb} radius={12} />
                    <View style={styles.flex}>
                      <Text variant="h3" numberOfLines={1}>
                        {b.title}
                      </Text>
                      {b.subtitle ? (
                        <Text variant="caption" numberOfLines={1}>
                          {b.subtitle}
                        </Text>
                      ) : null}
                      <View style={styles.metaRow}>
                        <Icon name="calendar" size={13} color={t.colors.muted} />
                        <Text variant="meta" style={styles.flex} numberOfLines={1}>
                          {bookingWhen(b)} · {tpr('shared.people', b.adults + b.children)}
                        </Text>
                      </View>
                      <Text variant="small" color="green900" style={styles.price}>
                        {b.pricing.totalAzn} AZN
                      </Text>
                    </View>
                    <Pill label={st.label} tone={st.tone} />
                  </View>

                  <View style={[styles.codeRow, payable && styles.codeRowPay]}>
                    <Text variant="caption">
                      {tr('shared.bookingCode')}{' '}
                      <Text variant="small" style={styles.code}>
                        {b.code}
                      </Text>
                    </Text>
                    <Text variant="small" color={payable ? 'brown700' : 'green900'} style={styles.link}>
                      {payable ? tr('myBookings.completePayment') : tr('myBookings.details')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: t.spacing.sm, paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.lg },
  body: { paddingHorizontal: t.spacing.page },
  list: { gap: t.spacing.md },
  card: {
    gap: t.spacing.md, padding: t.spacing.lg, backgroundColor: t.colors.paper,
    borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, ...t.shadows.sm,
  },
  pressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'flex-start' },
  thumb: { width: 60, height: 60, backgroundColor: t.colors.bg2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  price: { fontWeight: '700', marginTop: 2 },
  codeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: t.colors.green050, padding: t.spacing.md, borderRadius: t.radius.md,
  },
  codeRowPay: { backgroundColor: t.colors.brown100 },
  code: { fontWeight: '700', letterSpacing: 1 },
  link: { fontWeight: '600' },
  flex: { flex: 1, minWidth: 0 },
});
