import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import {
  Button, Card, EmptyState, ErrorState, ListSkeleton, Loading, Photo, Rating, Screen, Text, TopBar,
} from '@/components';
import { useCheckinCandidates } from '@/api/hooks/gamification';
import { locate, locateFailureText, type Coords, type LocateFailure } from '@/lib/location';
import i18n, { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

type Phase = { kind: 'locating' } | { kind: 'noLocation'; reason: LocateFailure } | { kind: 'located'; coords: Coords };

const distanceLabel = (km: number | null): string | null => {
  if (km === null || km === undefined) return null;
  return km < 1
    ? i18n.t('gamification:picker.meters', { value: Math.round(km * 1000) })
    : i18n.t('gamification:picker.km', { value: km });
};

/**
 * "Yarat" → "Check-in et": cihazın mövqeyinə ən yaxın məkanlar.
 *
 * Əvvəl bu düymə axtarışı açırdı — istifadəçi harada olduğunu özü tapmalı idi
 * və check-in yalnız səyahət planındakı elementdən mümkün idi.
 */
export function CheckinPickerScreen({ navigation }: AppScreenProps<'CheckinPicker'>) {
  const { t: tr } = useT('gamification');
  const [phase, setPhase] = useState<Phase>({ kind: 'locating' });
  const attempt = useRef(0);

  const run = useCallback(async () => {
    const id = ++attempt.current;
    setPhase({ kind: 'locating' });
    const result = await locate();
    if (id !== attempt.current) return;
    setPhase(result.ok ? { kind: 'located', coords: result.coords } : { kind: 'noLocation', reason: result.reason });
  }, []);

  useEffect(() => {
    void run();
    return () => {
      attempt.current += 1;
    };
  }, [run]);

  const coords = phase.kind === 'located' ? phase.coords : null;
  const places = useCheckinCandidates(coords);

  if (phase.kind === 'locating') {
    return (
      <Screen padded={false} scroll={false}>
        <TopBar title={tr('picker.title')} onBack={navigation.goBack} />
        <Loading label={tr('shared.locating')} />
      </Screen>
    );
  }

  if (phase.kind === 'noLocation') {
    return (
      <Screen padded={false} scroll={false}>
        <TopBar title={tr('picker.title')} onBack={navigation.goBack} />
        <EmptyState
          icon="pin"
          title={tr('shared.noLocationTitle')}
          message={tr('picker.noLocationMessage', { reason: locateFailureText(phase.reason) })}
          action={
            <View style={styles.actions}>
              <Button label={tr('common:actions.retry')} onPress={() => void run()} block />
              {phase.reason === 'denied' ? (
                <Button label={tr('shared.openSettings')} variant="outline" onPress={() => void Linking.openSettings()} block />
              ) : null}
              <Button label={tr('picker.searchInstead')} variant="soft" onPress={() => navigation.navigate('Search')} block />
            </View>
          }
        />
      </Screen>
    );
  }

  if (places.error && !places.isFetching && !places.data) {
    return <ErrorState error={places.error} onRetry={() => void places.refetch()} onBack={navigation.goBack} />;
  }

  const list = places.data?.data ?? [];

  return (
    <Screen padded={false}>
      <TopBar
        title={tr('picker.title')}
        onBack={navigation.goBack}
        actions={[{ icon: 'compass', label: tr('picker.refresh'), onPress: () => void run() }]}
      />

      <View style={styles.body}>
        <Text variant="small" color="ink2">
          {tr('picker.intro')}
        </Text>

        {places.isLoading ? (
          <ListSkeleton rows={5} thumb={56} />
        ) : list.length === 0 ? (
          <EmptyState
            icon="compass"
            title={tr('picker.emptyTitle')}
            message={tr('picker.emptyMessage')}
            action={<Button label={tr('picker.searchInstead')} variant="soft" onPress={() => navigation.navigate('Search')} />}
          />
        ) : (
          list.map((p) => (
            <Card key={p.slug} padded style={styles.row}>
              <Pressable
                style={styles.rowMain}
                onPress={() => navigation.navigate('PlaceDetail', { slug: p.slug })}
                accessibilityRole="button"
                accessibilityLabel={p.name}
              >
                <Photo uri={p.coverUrl} style={styles.thumb} radius={10} />
                <View style={styles.flex}>
                  <Text variant="h3" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="caption" numberOfLines={1}>
                    {[distanceLabel(p.distanceKm), p.region.name].filter(Boolean).join(' · ')}
                  </Text>
                  <Rating value={Number(p.rating)} size={12} />
                </View>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Checkin', { place: p.slug })}
                accessibilityRole="button"
                accessibilityLabel={tr('picker.checkinA11y', { name: p.name })}
                hitSlop={6}
                style={({ pressed }) => [styles.checkin, pressed && styles.pressed]}
              >
                <Text variant="small" color="green900" style={styles.checkinText}>
                  {tr('shared.checkin')}
                </Text>
              </Pressable>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.md },
  actions: { gap: t.spacing.sm, alignSelf: 'stretch', minWidth: 240 },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minWidth: 0 },
  thumb: { width: 56, height: 56, backgroundColor: t.colors.bg2 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  checkin: {
    paddingHorizontal: 14, height: 34, borderRadius: t.radius.pill,
    backgroundColor: t.colors.green100, alignItems: 'center', justifyContent: 'center',
  },
  checkinText: { fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
