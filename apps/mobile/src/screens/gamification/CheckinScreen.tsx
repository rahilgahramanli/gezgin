import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  Button, Card, Icon, Loading, Photo, Pill, Progress, Screen, Text, TopBar, type IconName,
} from '@/components';
import { useCheckin } from '@/api/hooks/gamification';
import { usePlaceDetail } from '@/api/hooks/details';
import { locate, locateFailureText, type LocateFailure } from '@/lib/location';
import { isGuestBlocked, isGuestSession, promptGuestSignup } from '@/lib/errors';
import { ApiError, NETWORK_ERROR } from '@/api/client';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

type Phase =
  | { kind: 'locating' }
  | { kind: 'noLocation'; reason: LocateFailure }
  | { kind: 'guest' }
  | { kind: 'sending' };

/**
 * Ekran 51 → 52 — check-in və XP mükafatı.
 *
 * Ekran açılan kimi əvvəlcə GPS oxunur, sonra check-in göndərilir. Server
 * mövqesiz check-in-i qəbul etmir (400), ona görə mövqe alınmasa API-yə
 * getmirik — səbəbi izah edib "Yenidən cəhd et" təklif edirik. Hər vəziyyətdə
 * geri düyməsi var: istifadəçi heç bir yüklənmə ekranında ilişib qalmır.
 */
export function CheckinScreen({ route, navigation }: AppScreenProps<'Checkin'>) {
  const { place: slug, trip } = route.params;
  const place = usePlaceDetail(slug);
  const checkin = useCheckin();
  const [phase, setPhase] = useState<Phase>({ kind: 'locating' });

  // Hər cəhdin nömrəsi — köhnə (və ya ekran bağlandıqdan sonra gələn) GPS cavabı nəzərə alınmır.
  // StrictMode-un ikiqat effekti də beləcə iki check-in göndərmir.
  const attempt = useRef(0);
  const { mutate, reset } = checkin;

  const run = useCallback(async () => {
    const id = ++attempt.current;
    reset();
    // Qonaq check-in edə bilməz — mövqe icazəsi istəməzdən əvvəl deyirik
    if (isGuestSession()) {
      setPhase({ kind: 'guest' });
      return;
    }
    setPhase({ kind: 'locating' });
    const result = await locate();
    if (id !== attempt.current) return;
    if (!result.ok) {
      setPhase({ kind: 'noLocation', reason: result.reason });
      return;
    }
    setPhase({ kind: 'sending' });
    mutate({
      place: slug,
      lat: result.coords.lat,
      lng: result.coords.lng,
      ...(trip ? { trip } : {}),
    });
  }, [mutate, reset, slug, trip]);

  useEffect(() => {
    void run();
    return () => {
      attempt.current += 1;
    };
  }, [run]);

  const retry = () => void run();
  const placeName = place.data?.name;

  if (phase.kind === 'locating') {
    return <Busy label="Mövqe müəyyən edilir…" onBack={navigation.goBack} />;
  }

  if (phase.kind === 'noLocation') {
    return (
      <Outcome
        icon="pin"
        title="Yerləşmə alınmadı"
        message={`${locateFailureText(phase.reason)} Check-in yalnız məkanda olduğun təsdiqlənəndə qeydə alınır.`}
        onBack={navigation.goBack}
      >
        <Button label="Yenidən cəhd et" onPress={retry} style={styles.cta} />
        {phase.reason === 'denied' ? (
          <Button label="Tənzimləmələri aç" variant="outline" onPress={() => void Linking.openSettings()} style={styles.ctaAlt} />
        ) : null}
        <Button label="Geri qayıt" variant="soft" onPress={navigation.goBack} style={styles.ctaAlt} />
      </Outcome>
    );
  }

  if (phase.kind === 'guest') {
    return (
      <Outcome icon="lock" title="Hesab lazımdır" message="Check-in edib XP qazanmaq üçün qeydiyyatdan keç." onBack={navigation.goBack}>
        <Button label="Qeydiyyatdan keç" onPress={() => promptGuestSignup()} style={styles.cta} />
        <Button label="Geri qayıt" variant="soft" onPress={navigation.goBack} style={styles.ctaAlt} />
      </Outcome>
    );
  }

  if (checkin.isPending || checkin.isIdle) {
    return <Busy label="Check-in edilir…" onBack={navigation.goBack} />;
  }

  if (checkin.error) {
    const err = checkin.error instanceof ApiError ? checkin.error : null;

    if (isGuestBlocked(checkin.error)) {
      return (
        <Outcome icon="lock" title="Hesab lazımdır" message={err?.message ?? 'Check-in üçün hesab yaratmalısan.'} onBack={navigation.goBack}>
          <Button label="Qeydiyyatdan keç" onPress={() => promptGuestSignup(err?.message)} style={styles.cta} />
          <Button label="Geri qayıt" variant="soft" onPress={navigation.goBack} style={styles.ctaAlt} />
        </Outcome>
      );
    }

    // 409 — bu gün burada artıq check-in olunub: təkrar cəhdin mənası yoxdur
    if (err?.status === 409) {
      return (
        <Outcome
          icon="check"
          tone="ok"
          title={placeName ?? 'Artıq check-in etmisən'}
          message={`${err.message}. Sabah yenidən gələ bilərsən.`}
          onBack={navigation.goBack}
        >
          <Button label="Geri qayıt" onPress={navigation.goBack} style={styles.cta} />
        </Outcome>
      );
    }

    const network = err?.code === NETWORK_ERROR;
    return (
      <Outcome
        icon={network ? 'wifiOff' : 'x'}
        title={network ? 'Bağlantı yoxdur' : 'Check-in alınmadı'}
        message={err?.message ?? 'Check-in alınmadı — bir az sonra yenidən cəhd et.'}
        onBack={navigation.goBack}
      >
        <Button label="Yenidən cəhd et" onPress={retry} style={styles.cta} />
        <Button label="Geri qayıt" variant="soft" onPress={navigation.goBack} style={styles.ctaAlt} />
      </Outcome>
    );
  }

  if (!checkin.data) return <Busy label="Check-in edilir…" onBack={navigation.goBack} />;
  const r = checkin.data.rewards;

  return (
    <Screen padded={false}>
      <TopBar onBack={navigation.goBack} actions={[{ icon: 'x', label: 'Bağla', onPress: navigation.goBack }]} />

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

/** Gözləmə — geri düyməsi ilə, istifadəçi heç vaxt ilişib qalmır. */
function Busy({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <Screen padded={false} scroll={false}>
      <TopBar title="Check-in" onBack={onBack} />
      <Loading label={label} />
    </Screen>
  );
}

/** Uğursuz nəticə — işarə, səbəb və hərəkət düymələri. */
function Outcome({
  icon,
  tone = 'error',
  title,
  message,
  onBack,
  children,
}: {
  icon: IconName;
  tone?: 'error' | 'ok';
  title: string;
  message: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <Screen padded={false}>
      <TopBar title="Check-in" onBack={onBack} />
      <View style={styles.center}>
        <View style={[styles.badge, tone === 'error' ? styles.badgeError : styles.badgeSoft]}>
          <Icon
            name={icon}
            size={34}
            color={tone === 'error' ? t.colors.danger : t.colors.green900}
            strokeWidth={2.4}
          />
        </View>
        <Text variant="titleLg" center>
          {title}
        </Text>
        <Text variant="meta" center style={styles.sub}>
          {message}
        </Text>
        {children}
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
  badgeSoft: { backgroundColor: t.colors.green100 },
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
  ctaAlt: { width: '100%' },
});
