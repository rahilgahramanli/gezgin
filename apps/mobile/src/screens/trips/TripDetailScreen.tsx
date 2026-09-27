import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { XP_RULES } from '@gezgin/shared';
import {
  Button, Card, ErrorState, Icon, Loading, Photo, Pill, Progress, Screen, Text, TopBar,
} from '@/components';
import {
  useCompleteTrip, useDeleteTrip, useStartTrip, useToggleTripItem, useTripDetail, type TripItem,
} from '@/api/hooks/tripDetail';
import { alertError } from '@/lib/errors';
import { TRIP_STATUS_LABEL, label } from '@/lib/labels';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 23 detalı — gün-gün plan, tamamlandı işarəsi, check-in keçidi, tamamla/sil. */
export function TripDetailScreen({ route, navigation }: AppScreenProps<'TripDetail'>) {
  const { publicId } = route.params;
  const trip = useTripDetail(publicId);
  const toggle = useToggleTripItem(publicId);
  const start = useStartTrip(publicId);
  const complete = useCompleteTrip(publicId);
  const remove = useDeleteTrip(publicId);

  if (!trip.data) {
    if (trip.error && !trip.isFetching) {
      return <ErrorState error={trip.error} onRetry={() => void trip.refetch()} onBack={navigation.goBack} />;
    }
    return (
      <Screen padded={false} scroll={false}>
        <TopBar title="Səyahət" onBack={navigation.goBack} />
        <Loading label="Səyahət yüklənir…" />
      </Screen>
    );
  }
  const tr = trip.data;
  const canComplete = tr.status === 'planned' || tr.status === 'active';

  const confirmDelete = () =>
    Alert.alert('Səyahət silinsin?', `“${tr.title}” planı və qeydləri silinəcək.`, [
      { text: 'İmtina', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: () => navigation.goBack(),
            onError: (error) => alertError(error, 'Səyahət silinmədi'),
          }),
      },
    ]);

  const confirmComplete = () =>
    Alert.alert(
      'Səyahəti tamamla',
      `Səyahət tamamlanmış kimi işarələnəcək. İlk tamamlama +${XP_RULES.trip_completed.xp} XP qazandırır.`,
      [
        { text: 'İmtina', style: 'cancel' },
        {
          text: 'Tamamla',
          onPress: () =>
            complete.mutate(undefined, {
              onSuccess: ({ rewards }) => {
                const xp = rewards?.xpGained ?? 0;
                Alert.alert(
                  xp > 0 ? `+${xp} XP` : 'Səyahət tamamlandı',
                  rewards?.leveledUp
                    ? `Level ${rewards.levelAfter}-ə yüksəldin!`
                    : xp > 0
                      ? 'Təbriklər, səyahət tamamlandı!'
                      : 'Səyahət yenidən tamamlandı — XP yalnız ilk dəfə verilir.',
                );
              },
              onError: (error) => alertError(error, 'Səyahət tamamlanmadı'),
            }),
        },
      ],
    );

  const busy = start.isPending || complete.isPending;

  return (
    <Screen
      padded={false}
      footer={
        canComplete ? (
          <View style={styles.footer}>
            {tr.status === 'planned' ? (
              <Button
                label="Səyahəti başlat"
                loading={start.isPending}
                disabled={busy}
                onPress={() => start.mutate(undefined, { onError: (error) => alertError(error, 'Səyahət başladılmadı') })}
                left={<Icon name="navigation" size={18} color="#fff" />}
                style={styles.ctaButton}
              />
            ) : null}
            <Button
              label="Səyahəti tamamla"
              variant={tr.status === 'active' ? 'primary' : 'ghost'}
              size={tr.status === 'active' ? 'lg' : 'sm'}
              loading={complete.isPending}
              disabled={busy}
              onPress={confirmComplete}
              left={
                <Icon name="flag" size={18} color={tr.status === 'active' ? '#fff' : t.colors.green900} />
              }
              style={styles.ctaButton}
            />
          </View>
        ) : null
      }
    >
      <TopBar
        title={tr.title}
        onBack={navigation.goBack}
        actions={[{ icon: 'trash', label: 'Səyahəti sil', onPress: confirmDelete }]}
      />

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
                  onToggle={() =>
                    toggle.mutate(
                      { itemId: item.itemId, isDone: !item.isDone },
                      { onError: (error) => alertError(error, 'Element yenilənmədi') },
                    )
                  }
                  onOpen={
                    item.target.slug && (item.type === 'place' || item.type === 'experience')
                      ? () =>
                          item.type === 'place'
                            ? navigation.navigate('PlaceDetail', { slug: item.target.slug as string })
                            : navigation.navigate('ExperienceDetail', { slug: item.target.slug as string })
                      : undefined
                  }
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
  onOpen,
  onCheckin,
}: {
  item: TripItem;
  onToggle: () => void;
  onOpen?: () => void;
  onCheckin?: () => void;
}) {
  return (
    <Card padded style={styles.item}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityLabel={`Tamamlandı işarəsi: ${item.target.name}`}
        accessibilityState={{ checked: item.isDone }}
      >
        <View style={[styles.checkbox, item.isDone && styles.checkboxOn]}>
          {item.isDone ? <Icon name="check" size={15} color="#fff" strokeWidth={2.6} /> : null}
        </View>
      </Pressable>

      <Photo uri={item.target.imageUrl} style={styles.itemThumb} radius={10} />

      <Pressable style={styles.flex} onPress={onOpen} disabled={!onOpen}>
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
      </Pressable>

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
  footer: { gap: t.spacing.sm, alignItems: 'center' },
  ctaButton: { width: '100%' },
});
