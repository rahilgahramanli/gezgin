import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, EmptyState, Loading, Photo, Pill, Screen, Text, TopBar } from '@/components';
import { useBookings } from '@/api/hooks/booking';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

const TABS = [
  { key: 'upcoming', label: 'Gələcək' },
  { key: 'past', label: 'Keçmiş' },
  { key: 'cancelled', label: 'Ləğv edilmiş' },
] as const;

const STATUS: Record<string, { label: string; tone: 'teal' | 'gold' | 'gray' }> = {
  confirmed: { label: 'Təsdiqlənib', tone: 'teal' },
  awaiting_payment: { label: 'Ödəniş gözlənilir', tone: 'gold' },
  pending: { label: 'Gözləyir', tone: 'gold' },
  completed: { label: 'Tamamlandı', tone: 'gray' },
  cancelled: { label: 'Ləğv edilib', tone: 'gray' },
};

/** Ekran 53 — rezervasiyalarım. */
export function MyBookingsScreen({ navigation }: AppScreenProps<'MyBookings'>) {
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const bookings = useBookings(tab);

  return (
    <Screen padded={false}>
      <TopBar title="Rezervasiyalarım" onBack={navigation.goBack} />

      <View style={styles.chips}>
        {TABS.map((tb) => (
          <Chip key={tb.key} label={tb.label} active={tab === tb.key} onPress={() => setTab(tb.key)} />
        ))}
      </View>

      <View style={styles.body}>
        {bookings.isLoading ? (
          <Loading />
        ) : !bookings.data?.data.length ? (
          <EmptyState
            title="Rezervasiya yoxdur"
            message="Təcrübə seç və bron et — biletin burada görünəcək."
          />
        ) : (
          <View style={styles.list}>
            {bookings.data.data.map((b) => {
              const st = STATUS[b.status] ?? { label: b.status, tone: 'gray' as const };
              return (
                <Card key={b.publicId} padded style={styles.card}>
                  <View style={styles.cardTop}>
                    <Photo uri={b.imageUrl} style={styles.thumb} radius={12} />
                    <View style={styles.flex}>
                      <Text variant="h3" numberOfLines={1}>
                        {b.title}
                      </Text>
                      <Text variant="meta">
                        {b.startAt ? b.startAt.slice(0, 10) : 'Tarixsiz'} ·{' '}
                        {b.adults + b.children} nəfər
                      </Text>
                      <Text variant="small" color="green900" style={styles.price}>
                        {b.pricing.totalAzn} AZN
                      </Text>
                    </View>
                    <Pill label={st.label} tone={st.tone} />
                  </View>

                  <View style={styles.codeRow}>
                    <Text variant="caption">Bron kodu</Text>
                    <Text variant="small" style={styles.code}>
                      {b.code}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row', gap: t.spacing.sm,
    paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.lg,
  },
  body: { paddingHorizontal: t.spacing.page },
  list: { gap: t.spacing.md },
  card: { gap: t.spacing.md },
  cardTop: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'flex-start' },
  thumb: { width: 60, height: 60, backgroundColor: t.colors.bg2 },
  price: { fontWeight: '700', marginTop: 2 },
  codeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: t.colors.green050, padding: t.spacing.md, borderRadius: t.radius.md,
  },
  code: { fontWeight: '700', letterSpacing: 1 },
  flex: { flex: 1, minWidth: 0 },
});
