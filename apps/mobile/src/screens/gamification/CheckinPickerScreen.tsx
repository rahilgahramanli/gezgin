import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import {
  Button, Card, EmptyState, ErrorState, ListSkeleton, Loading, Photo, Rating, Screen, Text, TopBar,
} from '@/components';
import { useCheckinCandidates } from '@/api/hooks/gamification';
import { locate, locateFailureText, type Coords, type LocateFailure } from '@/lib/location';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

type Phase = { kind: 'locating' } | { kind: 'noLocation'; reason: LocateFailure } | { kind: 'located'; coords: Coords };

const distanceLabel = (km: number | null): string | null => {
  if (km === null || km === undefined) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;
};

/**
 * "Yarat" → "Check-in et": cihazın mövqeyinə ən yaxın məkanlar.
 *
 * Əvvəl bu düymə axtarışı açırdı — istifadəçi harada olduğunu özü tapmalı idi
 * və check-in yalnız səyahət planındakı elementdən mümkün idi.
 */
export function CheckinPickerScreen({ navigation }: AppScreenProps<'CheckinPicker'>) {
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
        <TopBar title="Check-in et" onBack={navigation.goBack} />
        <Loading label="Mövqe müəyyən edilir…" />
      </Screen>
    );
  }

  if (phase.kind === 'noLocation') {
    return (
      <Screen padded={false} scroll={false}>
        <TopBar title="Check-in et" onBack={navigation.goBack} />
        <EmptyState
          icon="pin"
          title="Yerləşmə alınmadı"
          message={`${locateFailureText(phase.reason)} Yaxınlıqdakı məkanları göstərmək üçün mövqeyin lazımdır.`}
          action={
            <View style={styles.actions}>
              <Button label="Yenidən cəhd et" onPress={() => void run()} block />
              {phase.reason === 'denied' ? (
                <Button label="Tənzimləmələri aç" variant="outline" onPress={() => void Linking.openSettings()} block />
              ) : null}
              <Button label="Axtarışla tap" variant="soft" onPress={() => navigation.navigate('Search')} block />
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
        title="Check-in et"
        onBack={navigation.goBack}
        actions={[{ icon: 'compass', label: 'Mövqeyi yenilə', onPress: () => void run() }]}
      />

      <View style={styles.body}>
        <Text variant="small" color="ink2">
          Ən yaxın məkanlar. Check-in yalnız məkanın yanında olanda qəbul olunur və ilk ziyarət XP qazandırır.
        </Text>

        {places.isLoading ? (
          <ListSkeleton rows={5} thumb={56} />
        ) : list.length === 0 ? (
          <EmptyState
            icon="compass"
            title="Yaxınlıqda məkan tapılmadı"
            message="Başqa yerdə yenidən yoxla və ya məkanı axtarışla tap."
            action={<Button label="Axtarışla tap" variant="soft" onPress={() => navigation.navigate('Search')} />}
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
                accessibilityLabel={`Check-in: ${p.name}`}
                hitSlop={6}
                style={({ pressed }) => [styles.checkin, pressed && styles.pressed]}
              >
                <Text variant="small" color="green900" style={styles.checkinText}>
                  Check-in
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
