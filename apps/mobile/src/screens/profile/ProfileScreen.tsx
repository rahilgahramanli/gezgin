import { StyleSheet, View } from 'react-native';
import {
  Avatar, Button, Card, Loading, Photo, Pill, Progress, Screen, StatCell, Text,
} from '@/components';
import { useMe, useMyStats } from '@/api/hooks/me';
import { useLogout } from '@/api/hooks/auth';
import { t } from '@/theme';
import type { TabScreenProps } from '@/navigation/types';

/** Ekran 28 — profil, Gezgin Score və statistika. */
export function ProfileScreen({ navigation }: TabScreenProps<'Profile'>) {
  const me = useMe();
  const stats = useMyStats();
  const logout = useLogout();

  if (me.isLoading) return <Loading label="Profil yüklənir…" />;
  if (!me.data) return null;

  const g = me.data.gamification;

  return (
    <Screen padded={false}>
      <View style={styles.cover}>
        <Photo uri={me.data.coverUrl} style={styles.coverImage} radius={0} />
        <View style={styles.coverShade} />
      </View>

      <View style={styles.head}>
        <Avatar uri={me.data.avatarUrl} size={96} />
        <Text variant="titleLg" style={styles.name}>
          {me.data.fullName}
        </Text>
        <Text variant="meta">@{me.data.username}</Text>
        {me.data.homeRegion ? (
          <Text variant="meta">📍 {me.data.homeRegion.name}</Text>
        ) : null}
      </View>

      <View style={styles.body}>
        <Card padded style={styles.scoreCard} onPress={() => navigation.navigate('Score')}>
          <View style={styles.scoreTop}>
            <View>
              <Text variant="h3">Level {g.level}</Text>
              <Text variant="meta">{g.tier}</Text>
            </View>
            <View style={styles.scoreRight}>
              <Text variant="meta">Gezgin Score</Text>
              <Text variant="titleLg" color="green900">
                {g.gezginScore.toLocaleString('az-AZ')}
              </Text>
            </View>
          </View>

          <Progress percent={g.percent} />
          <View style={styles.xpRow}>
            <Text variant="small" color="muted">
              {g.xpInLevel} / {g.xpForLevel} XP
            </Text>
            <Text variant="small" color="muted">
              Növbəti levelə {g.xpToNext} XP
            </Text>
          </View>
        </Card>

        {stats.data ? (
          <View style={styles.stats}>
            <StatCell value={`${stats.data.regions}`} label="Regions" />
            <StatCell value={`${stats.data.places}`} label="Places" />
            <StatCell value={`${stats.data.experiences}`} label="Experiences" />
            <StatCell value={`${stats.data.routes}`} label="Routes" />
            <StatCell value={`${stats.data.wantToGo}`} label="Want to go" />
          </View>
        ) : null}

        {me.data.interests.length ? (
          <View style={styles.interests}>
            {me.data.interests.map((i) => (
              <Pill key={i.slug} label={i.name} tone="green" />
            ))}
          </View>
        ) : null}

        <View style={styles.links}>
          <Button label="Nailiyyətlər" variant="soft" onPress={() => navigation.navigate('Badges')} style={styles.link} />
          <Button label="Liderlər" variant="soft" onPress={() => navigation.navigate('Leaderboard')} style={styles.link} />
        </View>
        <Button label="Want to go" variant="outline" onPress={() => navigation.navigate('Saved')} />
        <Button label="Rezervasiyalarım" variant="outline" onPress={() => navigation.navigate('MyBookings')} />

        <Button
          label="Çıxış"
          variant="danger"
          onPress={() => logout.mutate()}
          loading={logout.isPending}
          style={styles.logout}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 150, backgroundColor: t.colors.green900 },
  coverImage: { width: '100%', height: 150 },
  coverShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,30,28,0.25)',
  },
  head: { alignItems: 'center', marginTop: -48, gap: 2 },
  name: { marginTop: t.spacing.sm },
  body: { paddingHorizontal: t.spacing.page, marginTop: t.spacing.lg, gap: t.spacing.lg },
  scoreCard: { gap: t.spacing.md },
  scoreTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  scoreRight: { alignItems: 'flex-end' },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  interests: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  links: { flexDirection: 'row', gap: t.spacing.md },
  link: { flex: 1 },
  logout: { marginTop: t.spacing.sm },
});
