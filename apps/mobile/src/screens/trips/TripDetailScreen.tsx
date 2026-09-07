import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button, Card, EmptyState, Icon, Loading, Photo, Pill, Progress, Screen, Text, TopBar,
} from '@/components';
import { useStartTrip, useToggleTripItem, useTripDetail, type TripItem } from '@/api/hooks/tripDetail';
import { TRIP_STATUS_LABEL, label } from '@/lib/labels';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 23 detalı — gün-gün plan, tamamlandı işarəsi, check-in keçidi. */
export function TripDetailScreen({ route, navigation }: AppScreenProps<'TripDetail'>) {
  const { publicId } = route.params;
  const trip = useTripDetail(publicId);
  const toggle = useToggleTripItem(publicId);
  const start = useStartTrip(publicId);

  if (trip.isLoading) return <Loading label="Səyahət yüklənir…" />;
  if (!trip.data) {
    return (
      <Screen padded={false}>
        <TopBar title="Səyahət" onBack={navigation.goBack} />
        <EmptyState title="Səyahət tapılmadı" />
      </Screen>
    );
  }
  const tr = trip.data;

  return (
    <Screen
      padded={false}
      // Tamamlanmış səyahətdə başlatmağa bir şey qalmır
      footer={
        tr.status !== 'completed' ? (
          <Button
            label={tr.status === 'active' ? 'Səyahət davam edir' : 'Səyahəti başlat'}
            disabled={tr.status === 'active'}
            loading={start.isPending}
            onPress={() => start.mutate()}
            left={<Icon name="navigation" size={18} color="#fff" />}
            style={styles.ctaButton}
          />
        ) : null
      }
    >
      <TopBar title={tr.title} onBack={navigation.goBack} />

      <View style={styles.head}>
        <View style={styles.headRow}>
          <Pill label={label(TRIP_STATUS_LABEL, tr.status)} tone={tr.status === 'active' ? 'teal' : 'gray'} />
          <Text variant="meta">
            {tr.startDate ? tr.startDate.slice(0, 10) : 'Tarixsiz'} · {tr.travelers} nəfər
          </Text>
        </View>

        <Progress percent={tr.progress.percent} />
        <View style={styles.progressMeta}>
          <Text variant="small" color="muted">
            {tr.progress.done} / {tr.progress.total} tamamlandı
          </Text>
          <Text variant="small" color="green900" style={styles.bold}>
            {tr.progress.percent}%
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {tr.itinerary.map((day) => (
          <View key={day.day} style={styles.day}>
            <View style={styles.dayHead}>
              <Pill label={`${day.day}-ci gün`} tone="green" />
              {day.date ? <Text variant="caption">{day.date.slice(0, 10)}</Text> : null}
            </View>

            {day.items.length === 0 ? (
              <Text variant="meta" style={styles.emptyDay}>
                Bu günə hələ nə isə əlavə edilməyib
              </Text>
            ) : (
              day.items.map((item) => (
                <ItemRow
                  key={item.itemId}
                  item={item}
                  onToggle={() => toggle.mutate({ itemId: item.itemId, isDone: !item.isDone })}
                  onCheckin={
                    item.type === 'place' && item.target.slug && !item.isDone
                      ? () =>
                          navigation.navigate('Checkin', {
                            place: item.target.slug as string,
                            trip: tr.publicId,
                          })
                      : undefined
                  }
                />
              ))
            )}
          </View>
        ))}

        {tr.notes.length ? (
          <View style={styles.day}>
            <Text variant="h2">Qeydlər</Text>
            {tr.notes.map((n) => (
              <Card key={n.id} padded>
                <Text variant="small" color="ink2">
                  {n.body}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function ItemRow({
  item,
  onToggle,
  onCheckin,
}: {
  item: TripItem;
  onToggle: () => void;
  onCheckin?: () => void;
}) {
  return (
    <Card padded style={styles.item}>
      <Pressable onPress={onToggle} hitSlop={8}>
        <View style={[styles.checkbox, item.isDone && styles.checkboxOn]}>
          {item.isDone ? <Icon name="check" size={15} color="#fff" strokeWidth={2.6} /> : null}
        </View>
      </Pressable>

      <Photo uri={item.target.imageUrl} style={styles.itemThumb} radius={10} />

      <View style={styles.flex}>
        <Text variant="h3" numberOfLines={1} style={item.isDone ? styles.done : undefined}>
          {item.target.name}
        </Text>
        <View style={styles.itemMeta}>
          {item.startTime ? (
            <>
              <Icon name="clock" size={12} color={t.colors.muted} />
              <Text variant="caption">{item.startTime}</Text>
            </>
          ) : null}
          {item.durationMin ? <Text variant="caption">· {item.durationMin} dəq</Text> : null}
          {item.target.priceAzn ? <Text variant="caption">· {item.target.priceAzn} AZN</Text> : null}
        </View>
      </View>

      {onCheckin ? (
        <Button label="Check-in" variant="soft" size="xs" onPress={onCheckin} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: t.spacing.page, gap: t.spacing.sm, paddingBottom: t.spacing.lg },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: '700' },
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.xl },
  day: { gap: t.spacing.md },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emptyDay: { paddingLeft: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 1.5,
    borderColor: t.colors.line, alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: t.colors.green900, borderColor: t.colors.green900 },
  itemThumb: { width: 44, height: 44, backgroundColor: t.colors.bg2 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  done: { textDecorationLine: 'line-through', color: t.colors.muted },
  flex: { flex: 1, minWidth: 0 },
  ctaButton: { width: '100%' },
});
