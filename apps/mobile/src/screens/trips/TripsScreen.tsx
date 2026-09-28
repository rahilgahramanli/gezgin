import { StyleSheet, View } from 'react-native';
import {
  Button, Card, EmptyState, GuestEmpty, Icon, Loading, Photo, Pill, Progress, Screen, Text,
} from '@/components';
import { useUser } from '@/store/auth';
import { useT } from '@/i18n';
import { errorText } from '@/lib/errors';
import { useTrips } from '@/api/hooks/trips';
import { TRIP_STATUS_LABEL, label } from '@/lib/labels';
import { t } from '@/theme';
import type { TabScreenProps } from '@/navigation/types';

/** Ekran 23 — Planım. */
export function TripsScreen({ navigation }: TabScreenProps<'Trips'>) {
  const { t: tr, tp: tpr } = useT('trips');
  const isGuest = useUser()?.isGuest ?? false;
  const trips = useTrips();

  if (trips.isLoading) return <Loading label={tr('shared.loadingTrips')} />;

  const list = trips.data?.data ?? [];

  return (
    <Screen>
      <View style={styles.head}>
        <View style={styles.headRow}>
          <View style={styles.flex}>
            <Text variant="titleXl">{tr('list.title')}</Text>
            <Text variant="meta">{tr('list.subtitle')}</Text>
          </View>
          <Button
            label={tr('list.new')}
            variant="soft"
            size="sm"
            left={<Icon name="plus" size={16} color={t.colors.green900} />}
            onPress={() => navigation.navigate('CreateTrip')}
          />
        </View>
      </View>

      {isGuest ? (
        <GuestEmpty
          icon="route"
          title={tr('list.guestTitle')}
          message={tr('list.guestMessage')}
        />
      ) : trips.isError && list.length === 0 ? (
        <EmptyState
          icon="wifiOff"
          title={tr('list.errorTitle')}
          message={errorText(trips.error, tr('common:states.tryLater'))}
          action={<Button label={tr('common:actions.retry')} variant="soft" onPress={() => void trips.refetch()} />}
        />
      ) : list.length === 0 ? (
        <EmptyState
          title={tr('list.emptyTitle')}
          message={tr('list.emptyMessage')}
          action={<Button label={tr('shared.createTrip')} onPress={() => navigation.navigate('CreateTrip')} />}
        />
      ) : (
        <View style={styles.list}>
          {list.map((trip) => (
            <Card
              key={trip.publicId}
              padded
              style={styles.card}
              onPress={() => navigation.navigate('TripDetail', { publicId: trip.publicId })}
            >
              <View style={styles.cardHead}>
                <Photo uri={trip.coverUrl} style={styles.cover} radius={12} />
                <View style={styles.cardBody}>
                  <View style={styles.titleRow}>
                    <Text variant="h3" numberOfLines={1} style={styles.title}>
                      {trip.title}
                    </Text>
                    <Pill
                      label={label(TRIP_STATUS_LABEL, trip.status)}
                      tone={trip.status === 'active' ? 'teal' : 'gray'}
                    />
                  </View>
                  <Text variant="meta" numberOfLines={1}>
                    {trip.startDate ? trip.startDate.slice(0, 10) : tr('list.noDate')}
                    {' · '}
                    {tpr('shared.days', trip.dayCount)} · {tpr('shared.people', trip.travelers)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressRow}>
                <Progress percent={trip.progressPercent} />
                <View style={styles.progressMeta}>
                  <Text variant="small" color="muted">
                    {tr('shared.progressDone', { done: trip.doneCount, total: trip.itemCount })}
                  </Text>
                  <Text variant="small" color="green900" style={styles.percent}>
                    {trip.progressPercent}%
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: t.spacing.lg },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  flex: { flex: 1, minWidth: 0 },
  list: { gap: t.spacing.md },
  card: { gap: t.spacing.md },
  cardHead: { flexDirection: 'row', gap: t.spacing.md },
  cover: { width: 64, height: 64, backgroundColor: t.colors.bg2 },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  title: { flex: 1, minWidth: 0 },
  progressRow: { gap: 6 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  percent: { fontWeight: '700' },
});
