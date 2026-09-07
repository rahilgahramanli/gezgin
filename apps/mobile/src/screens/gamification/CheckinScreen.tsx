import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button, Card, Icon, Loading, Photo, Pill, Progress, Screen, Text, TopBar,
} from '@/components';
import { useCheckin } from '@/api/hooks/gamification';
import { usePlaceDetail } from '@/api/hooks/details';
import { getCurrentPosition } from '@/lib/location';
import { ApiError } from '@/api/client';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/**
 * Ekran 51 → 52 — check-in və XP mükafatı.
 *
 * Ekran açılan kimi əvvəlcə GPS oxunur, sonra check-in göndərilir. Mövqe
 * alınmasa `lat`/`lng` göndərilmir və server məsafə yoxlamasını ötürür —
 * axın icazə verilməyən cihazda da işləyir.
 */
export function CheckinScreen({ route, navigation }: AppScreenProps<'Checkin'>) {
  const { place: slug, trip } = route.params;
  const place = usePlaceDetail(slug);
  const checkin = useCheckin();
  const [locating, setLocating] = useState(true);

  // StrictMode ikiqat çağırışında iki check-in getməsin
  const sent = useRef(false);
  const { mutate, reset } = checkin;

  const send = useCallback(async () => {
    setLocating(true);
    const coords = await getCurrentPosition();
    setLocating(false);
    mutate({
      place: slug,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      ...(trip ? { trip } : {}),
    });
  }, [mutate, slug, trip]);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void send();
  }, [send]);

  const retry = () => {
    reset();
    void send();
  };

  if (locating) return <Loading label="Mövqe müəyyən edilir…" />;
  if (place.isLoading || checkin.isPending) return <Loading label="Check-in edilir…" />;

  if (checkin.error) {
    const message =
      checkin.error instanceof ApiError ? checkin.error.message : 'Check-in alınmadı';
    return (
      <Screen padded={false}>
        <TopBar onBack={navigation.goBack} />
        <View style={styles.center}>
          <View style={[styles.badge, styles.badgeError]}>
            <Icon name="x" size={34} color={t.colors.danger} strokeWidth={2.4} />
          </View>
          <Text variant="titleLg" center>
            Check-in alınmadı
          </Text>
          <Text variant="meta" center style={styles.sub}>
            {message}
          </Text>
          <Button label="Yenidən cəhd et" onPress={retry} style={styles.cta} />
          <Button label="Geri qayıt" variant="soft" onPress={navigation.goBack} style={styles.cta} />
        </View>
      </Screen>
    );
  }

  if (!checkin.data) return null;
  const r = checkin.data.rewards;

  return (
    <Screen padded={false}>
      <TopBar onBack={navigation.goBack} actions={[{ icon: 'x', onPress: navigation.goBack }]} />

      <View style={styles.center}>
        <View style={styles.badge}>
          <Icon name="check" size={40} color="#fff" strokeWidth={2.6} />
        </View>

        <Text variant="titleLg" center>
          {checkin.data.place.name}
        </Text>
        <Text variant="meta" center style={styles.sub}>
          {checkin.data.isFirstVisit
            ? `${checkin.data.place.region.name} · ilk ziyarətin!`
            : 'Bu məkanda əvvəl olmusan'}
        </Text>

        {place.data?.photos[0]?.url ? (
          <Photo uri={place.data.photos[0].url} style={styles.photo} radius={t.radius.lg} />
        ) : null}

        {/* Mükafat kartı — ekran 52 */}
        <Card padded style={styles.reward}>
          <View style={styles.rewardTop}>
            <View>
              <Text variant="titleLg" color="green900">
                +{r.xpGained} XP
              </Text>
              <Text variant="caption">
                {r.cappedByDailyLimit ? 'gündəlik limit dolub' : 'təcrübə xalı'}
              </Text>
            </View>
            <View style={styles.rewardRight}>
              <Text variant="h2" color="teal400">
                +{r.scoreDelta}
              </Text>
              <Text variant="caption">Gezgin Score</Text>
            </View>
          </View>

          <Progress percent={r.percent} />
          <View style={styles.levelRow}>
            <Text variant="small" color="muted">
              Level {r.levelAfter} · {r.tier}
            </Text>
            <Text variant="small" color="muted">
              növbətiyə {r.xpToNext} XP
            </Text>
          </View>

          {r.leveledUp ? (
            <View style={styles.levelUp}>
              <Icon name="sparkle" size={18} color={t.colors.brown700} />
              <Text variant="small" color="brown700" style={styles.bold}>
                Level {r.levelBefore} → {r.levelAfter}! Təbriklər 🎉
              </Text>
            </View>
          ) : null}
        </Card>

        {r.newBadges.length ? (
          <View style={styles.badges}>
            <Text variant="h3" center>
              Yeni nailiyyət
            </Text>
            <View style={styles.badgeList}>
              {r.newBadges.map((b) => (
                <Pill key={b.slug} label={`🏅 ${b.name}`} tone="teal" />
              ))}
            </View>
          </View>
        ) : null}

        {checkin.data.trip ? (
          <Card padded style={styles.tripCard}>
            <Text variant="small" color="ink2">
              Səyahət planı: {checkin.data.trip.done} / {checkin.data.trip.total} tamamlandı
            </Text>
            <Progress percent={checkin.data.trip.percent} thin />
          </Card>
        ) : null}

        <Button label="Davam et" onPress={navigation.goBack} style={styles.cta} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingHorizontal: t.spacing.page, alignItems: 'center', gap: t.spacing.md },
  badge: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center',
    marginTop: t.spacing.lg, marginBottom: t.spacing.sm,
  },
  badgeError: { backgroundColor: '#FBE9E7' },
  sub: { marginTop: -6 },
  photo: { width: '100%', height: 160, marginTop: t.spacing.sm },
  reward: { width: '100%', gap: t.spacing.md, marginTop: t.spacing.sm },
  rewardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rewardRight: { alignItems: 'flex-end' },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  levelUp: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: t.colors.brown100, padding: t.spacing.md, borderRadius: t.radius.md,
  },
  bold: { fontWeight: '700' },
  badges: { alignItems: 'center', gap: t.spacing.sm, marginTop: t.spacing.sm },
  badgeList: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, justifyContent: 'center' },
  tripCard: { width: '100%', gap: t.spacing.sm },
  cta: { width: '100%', marginTop: t.spacing.lg },
});
