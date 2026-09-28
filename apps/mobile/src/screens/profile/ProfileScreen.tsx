import { StyleSheet, View } from 'react-native';
import {
  Avatar, Button, Card, ErrorState, Icon, Loading, Photo, Pill, Progress, Screen, StatCell, Text, TopBar,
} from '@/components';
import { useMe, useMyStats } from '@/api/hooks/me';
import { t } from '@/theme';
import type { TabScreenProps } from '@/navigation/types';

/** Ekran 28 — profil, Gezgin Score və statistika. */
export function ProfileScreen({ navigation }: TabScreenProps<'Profile'>) {
  const me = useMe();
  const stats = useMyStats();

  if (!me.data) {
    // Tab ekranıdır — geri yolu yoxdur, amma ağ ekran da olmamalıdır
    return me.error && !me.isFetching ? (
      <ErrorState error={me.error} onRetry={() => void me.refetch()} />
    ) : (
      <Loading label="Profil yüklənir…" />
    );
  }

  const g = me.data.gamification;
  const openMyProfile = () => navigation.navigate('UserProfile', { username: me.data!.username });

  return (
    <Screen padded={false}>
      <View style={styles.cover}>
        <Photo uri={me.data.coverUrl} style={styles.coverImage} radius={0} />
        <View style={styles.coverShade} />
        <View style={styles.coverBar}>
          <TopBar
            light
            transparent
            actions={[
              { icon: 'edit', label: 'Profili redaktə et', onPress: () => navigation.navigate('EditProfile') },
              { icon: 'settings', label: 'Tənzimləmələr', onPress: () => navigation.navigate('Settings') },
            ]}
          />
        </View>
      </View>

      <View style={styles.head}>
        <Avatar uri={me.data.avatarUrl} size={96} name={me.data.fullName} />
        <Text variant="titleLg" style={styles.name}>
          {me.data.fullName}
        </Text>
        <Text variant="meta">@{me.data.username}</Text>
        {me.data.bio ? (
          <Text variant="small" color="ink2" center numberOfLines={3} style={styles.bio}>
            {me.data.bio}
          </Text>
        ) : null}
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
            <StatCell value={`${stats.data.regions}`} label="Regionlar" onPress={() => navigation.navigate('Regions')} />
            <StatCell value={`${stats.data.places}`} label="Məkanlar" onPress={() => navigation.navigate('Regions')} />
            <StatCell value={`${stats.data.experiences}`} label="Təcrübələr" onPress={() => navigation.navigate('MyBookings')} />
            <StatCell value={`${stats.data.routes}`} label="Marşrutlar" onPress={openMyProfile} />
            <StatCell value={`${stats.data.wantToGo}`} label="İstəklərim" onPress={() => navigation.navigate('Saved')} />
          </View>
        ) : null}

        {me.data.interests.length ? (
          <View style={styles.interests}>
            {me.data.interests.map((i) => (
              <Pill key={i.slug} label={i.name} tone="green" />
            ))}
          </View>
        ) : null}

        {stats.data ? (
          <View style={styles.links}>
            <Button
              label={`${stats.data.followers} izləyici`}
              variant="outline"
              size="sm"
              onPress={() => navigation.navigate('Followers', { username: me.data!.username, tab: 'followers' })}
              style={styles.link}
            />
            <Button
              label={`${stats.data.following} izlənən`}
              variant="outline"
              size="sm"
              onPress={() => navigation.navigate('Followers', { username: me.data!.username, tab: 'following' })}
              style={styles.link}
            />
          </View>
        ) : null}
        <Button
          label="Paylaşımlarım"
          variant="soft"
          onPress={() => navigation.navigate('UserProfile', { username: me.data!.username })}
        />

        <View style={styles.links}>
          <Button label="Nailiyyətlər" variant="soft" onPress={() => navigation.navigate('Badges')} style={styles.link} />
          <Button label="Liderlər" variant="soft" onPress={() => navigation.navigate('Leaderboard')} style={styles.link} />
        </View>
        <Button label="İstəklərim" variant="outline" onPress={() => navigation.navigate('Saved')} />
        <Button label="Rezervasiyalarım" variant="outline" onPress={() => navigation.navigate('MyBookings')} />

        <Button
          label="Profili redaktə et"
          variant="outline"
          left={<Icon name="edit" size={18} color={t.colors.green900} />}
          onPress={() => navigation.navigate('EditProfile')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bio: { marginTop: 6, paddingHorizontal: t.spacing.page },
  coverBar: { position: 'absolute', top: 0, left: 0, right: 0 },
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
