import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { XP_RULES } from '@gezgin/shared';
import {
  Button, Card, ErrorState, Icon, Loading, Photo, Pill, Progress, Screen, Text, TopBar,
} from '@/components';
import {
  useCompleteTrip, useDeleteTrip, useStartTrip, useToggleTripItem, useTripDetail, type TripItem,
} from '@/api/hooks/tripDetail';
import { alertError } from '@/lib/errors';
import { useT } from '@/i18n';
import { TRIP_STATUS_LABEL, label } from '@/lib/labels';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 23 detalı — gün-gün plan, tamamlandı işarəsi, check-in keçidi, tamamla/sil. */
export function TripDetailScreen({ route, navigation }: AppScreenProps<'TripDetail'>) {
  const { publicId } = route.params;
  const { t: tr, tp: tpr } = useT('trips');
  const detail = useTripDetail(publicId);
  const toggle = useToggleTripItem(publicId);
  const start = useStartTrip(publicId);
  const complete = useCompleteTrip(publicId);
  const remove = useDeleteTrip(publicId);

  if (!detail.data) {
    if (detail.error && !detail.isFetching) {
      return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} onBack={navigation.goBack} />;
    }
    return (
      <Screen padded={false} scroll={false}>
        <TopBar title={tr('detail.title')} onBack={navigation.goBack} />
        <Loading label={tr('detail.loading')} />
      </Screen>
    );
  }
  const trip = detail.data;
  const canComplete = trip.status === 'planned' || trip.status === 'active';

  const confirmDelete = () =>
    Alert.alert(tr('detail.deleteTitle'), tr('detail.deleteMessage', { title: trip.title }), [
      { text: tr('common:actions.cancel'), style: 'cancel' },
      {
        text: tr('common:actions.delete'),
        style: 'destructive',
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: () => navigation.goBack(),
            onError: (error) => alertError(error, tr('detail.deleteFailed')),
          }),
      },
    ]);

  const confirmComplete = () =>
    Alert.alert(
      tr('detail.completeTrip'),
      tr('detail.completeMessage', { xp: XP_RULES.trip_completed.xp }),
      [
        { text: tr('common:actions.cancel'), style: 'cancel' },
        {
          text: tr('detail.complete'),
          onPress: () =>
            complete.mutate(undefined, {
              onSuccess: ({ rewards }) => {
                const xp = rewards?.xpGained ?? 0;
                Alert.alert(
                  xp > 0 ? tr('shared.xpGain', { xp }) : tr('detail.completed'),
                  rewards?.leveledUp
                    ? tr('detail.levelUp', { level: rewards.levelAfter })
                    : xp > 0
                      ? tr('detail.congrats')
                      : tr('detail.recompleted'),
                );
              },
              onError: (error) => alertError(error, tr('detail.completeFailed')),
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
            {trip.status === 'planned' ? (
              <Button
                label={tr('detail.start')}
                loading={start.isPending}
                disabled={busy}
                onPress={() => start.mutate(undefined, { onError: (error) => alertError(error, tr('detail.startFailed')) })}
                left={<Icon name="navigation" size={18} color="#fff" />}
                style={styles.ctaButton}
              />
            ) : null}
            <Button
              label={tr('detail.completeTrip')}
              variant={trip.status === 'active' ? 'primary' : 'ghost'}
              size={trip.status === 'active' ? 'lg' : 'sm'}
              loading={complete.isPending}
              disabled={busy}
              onPress={confirmComplete}
              left={
                <Icon name="flag" size={18} color={trip.status === 'active' ? '#fff' : t.colors.green900} />
              }
              style={styles.ctaButton}
            />
          </View>
        ) : null
      }
    >
      <TopBar
        title={trip.title}
        onBack={navigation.goBack}
        actions={[{ icon: 'trash', label: tr('detail.deleteA11y'), onPress: confirmDelete }]}
      />

      <View style={styles.head}>
        <View style={styles.headRow}>
          <Pill label={label(TRIP_STATUS_LABEL, trip.status)} tone={trip.status === 'active' ? 'teal' : 'gray'} />
          <Text variant="meta">
            {trip.startDate ? trip.startDate.slice(0, 10) : tr('shared.undated')} · {tpr('shared.people', trip.travelers)}
          </Text>
        </View>

        <Progress percent={trip.progress.percent} />
        <View style={styles.progressMeta}>
          <Text variant="small" color="muted">
            {tr('shared.progressDone', { done: trip.progress.done, total: trip.progress.total })}
          </Text>
          <Text variant="small" color="green900" style={styles.bold}>
            {trip.progress.percent}%
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {trip.itinerary.map((day) => (
          <View key={day.day} style={styles.day}>
            <View style={styles.dayHead}>
              <Pill label={tr('shared.dayN', { day: day.day })} tone="green" />
              {day.date ? <Text variant="caption">{day.date.slice(0, 10)}</Text> : null}
            </View>

            {day.items.length === 0 ? (
              <Text variant="meta" style={styles.emptyDay}>
                {tr('detail.emptyDay')}
              </Text>
            ) : (
              day.items.map((item) => (
                <ItemRow
                  key={item.itemId}
                  item={item}
                  onToggle={() =>
                    toggle.mutate(
                      { itemId: item.itemId, isDone: !item.isDone },
                      { onError: (error) => alertError(error, tr('detail.itemFailed')) },
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
                            trip: trip.publicId,
                          })
                      : undefined
                  }
                />
              ))
            )}
          </View>
        ))}

        {trip.notes.length ? (
          <View style={styles.day}>
            <Text variant="h2">{tr('detail.notes')}</Text>
            {trip.notes.map((n) => (
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
  const { t: tr } = useT('trips');
  return (
    <Card padded style={styles.item}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityLabel={tr('detail.itemDoneA11y', { name: item.target.name })}
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
          {item.durationMin ? <Text variant="caption">· {tr('detail.minutes', { min: item.durationMin })}</Text> : null}
          {item.target.priceAzn ? <Text variant="caption">· {item.target.priceAzn} AZN</Text> : null}
        </View>
      </Pressable>

      {onCheckin ? (
        <Button label={tr('detail.checkin')} variant="soft" size="xs" onPress={onCheckin} />
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
