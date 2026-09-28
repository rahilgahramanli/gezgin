import { useState } from 'react';
import { TIERS } from '@gezgin/shared';
import { Alert, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  Avatar, Button, Card, ErrorState, Icon, Loading, Photo, Pill, Rating, RowCard, Screen, StatCell, Text, TopBar,
} from '@/components';
import {
  REPORT_REASONS, useBlockUser, useFollow, useOpenConversation, useReportUser, useUserBadges, useUserPosts,
  useUserProfile, useUserRoutes,
} from '@/api/hooks/social';
import { useExperiences } from '@/api/hooks/content';
import { useMyRoutes } from '@/api/hooks/routeBuilder';
import { compactCount, formatNumber } from '@/lib/time';
import { durationLabel } from '@/lib/labels';
import { t } from '@/theme';
import { alertError } from '@/lib/errors';
import { useT } from '@/i18n';
import type { AppScreenProps } from '@/navigation/types';

type Tab = 'posts' | 'routes' | 'badges';

/** Ekran 41 — gezgin profili: statistika, izlə/mesaj, paylaşım şəbəkəsi, marşrutlar, nailiyyətlər. */
export function UserProfileScreen({ route, navigation }: AppScreenProps<'UserProfile'>) {
  const { username } = route.params;
  const { t: tr, tp: tpr } = useT('social');
  const { width: screen } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('posts');

  const profile = useUserProfile(username);
  const follow = useFollow();
  const open = useOpenConversation();
  const block = useBlockUser();
  const report = useReportUser();
  const posts = useUserPosts(username, tab === 'posts');
  // Öz profilində şəxsi marşrutlar da görünməlidir — ictimai siyahı onları vermir
  const isMe = profile.data?.viewer.isMe ?? false;
  const publicRoutes = useUserRoutes(username, tab === 'routes' && profile.isSuccess && !isMe);
  const myRoutes = useMyRoutes(tab === 'routes' && isMe);
  const routes = isMe ? myRoutes : publicRoutes;
  const badges = useUserBadges(username, tab === 'badges');
  // Ekran 21 — expert profilində təklif etdiyi təcrübələr də göstərilir
  const expertProfile = profile.data?.expert ?? null;
  const experiences = useExperiences({ expert: username, limit: 10 });

  if (!profile.data) {
    if (profile.error && !profile.isFetching) {
      return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} onBack={navigation.goBack} />;
    }
    return (
      <Screen padded={false} scroll={false}>
        <TopBar onBack={navigation.goBack} />
        <Loading label={tr('userProfile.loading')} />
      </Screen>
    );
  }

  const u = profile.data;
  const tile = (screen - t.spacing.page * 2 - t.spacing.xs * 2) / 3;
  const postList = posts.data?.pages.flatMap((p) => p.data) ?? [];
  // API tier adını azərbaycanca verir — koda çevirib cari dildə göstəririk
  const tierCode = TIERS.find((x) => x.nameAz === u.tier)?.code;
  const tierLabel = tierCode ? tr(`userProfile.tiers.${tierCode}`) : u.tier;

  const message = () =>
    open.mutate(username, {
      onSuccess: (c) => navigation.navigate('Chat', { publicId: c.publicId }),
      onError: (e) => alertError(e, tr('userProfile.chatFailed')),
    });

  const askReport = () =>
    Alert.alert(tr('shared.whyReport'), undefined, [
      ...REPORT_REASONS.map((r) => ({
        text: r.label,
        onPress: () =>
          report.mutate(
            { username, reason: r.code },
            {
              onSuccess: (res) =>
                Alert.alert(
                  tr('shared.thanks'),
                  res.duplicate ? tr('userProfile.reportDuplicate') : tr('shared.reportSent'),
                ),
              onError: (e) => alertError(e, tr('userProfile.reportFailed')),
            },
          ),
      })),
      { text: tr('common:actions.cancel'), style: 'cancel' as const },
    ]);

  const askBlock = () =>
    Alert.alert(
      tr('userProfile.blockTitle', { name: u.fullName }),
      tr('userProfile.blockMessage'),
      [
        { text: tr('common:actions.cancel'), style: 'cancel' },
        {
          text: tr('userProfile.block'),
          style: 'destructive',
          onPress: () =>
            block.mutate(username, {
              onSuccess: () => {
                Alert.alert(tr('userProfile.blockedTitle'), tr('userProfile.blockedMessage', { name: u.fullName }));
                navigation.goBack();
              },
              onError: (e) => alertError(e, tr('userProfile.blockFailed')),
            }),
        },
      ],
    );

  const openMenu = () =>
    Alert.alert(u.fullName, undefined, [
      { text: tr('shared.report'), onPress: askReport },
      { text: tr('userProfile.block'), style: 'destructive', onPress: askBlock },
      { text: tr('common:actions.cancel'), style: 'cancel' },
    ]);

  return (
    <Screen padded={false} edges={[]}>
      <View style={styles.cover}>
        {u.coverUrl ? <Photo uri={u.coverUrl} style={styles.coverImage} radius={0} /> : null}
        <View style={styles.coverShade} />
        <View style={styles.coverBar}>
          <TopBar
            light
            transparent
            onBack={navigation.goBack}
            actions={u.viewer.isMe ? undefined : [{ icon: 'more', onPress: openMenu, label: tr('common:actions.more') }]}
          />
        </View>
      </View>

      <View style={styles.head}>
        <Avatar uri={u.avatarUrl} size={96} name={u.fullName} />
        <View style={styles.nameRow}>
          <Text variant="titleLg">{u.fullName}</Text>
          {u.isVerified ? <Icon name="check" size={18} color={t.colors.teal400} strokeWidth={3} /> : null}
        </View>
        <Text variant="meta">
          @{u.username}
          {u.homeRegion ? ` · ${u.homeRegion.name}` : ''}
        </Text>
        <View style={styles.pills}>
          <Pill label={tr('userProfile.levelTier', { level: u.level, tier: tierLabel })} tone="green" />
          {u.isLocalExpert ? <Pill label="Local Expert" tone="brown" /> : null}
          {u.viewer.followsYou ? <Pill label={tr('userProfile.followsYou')} tone="gray" /> : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.stats}>
          <Pressable style={styles.stat} onPress={() => navigation.push('Followers', { username, tab: 'followers' })}>
            <StatCell value={compactCount(u.stats.followers)} label={tr('userProfile.followers')} />
          </Pressable>
          <Pressable style={styles.stat} onPress={() => navigation.push('Followers', { username, tab: 'following' })}>
            <StatCell value={compactCount(u.stats.following)} label={tr('userProfile.following')} />
          </Pressable>
          <View style={styles.stat}>
            <StatCell value={formatNumber(u.gezginScore)} label="Gezgin Score" />
          </View>
        </View>

        {!u.viewer.isMe ? (
          <View style={styles.actions}>
            <Button
              label={u.viewer.isFollowing ? tr('shared.youFollow') : tr('shared.follow')}
              variant={u.viewer.isFollowing ? 'outline' : 'primary'}
              size="sm"
              style={styles.flex}
              onPress={() => follow.mutate({ username, follow: !u.viewer.isFollowing })}
            />
            <Button
              label={tr('userProfile.message')}
              variant="soft"
              size="sm"
              style={styles.flex}
              loading={open.isPending}
              left={<Icon name="chat" size={16} color={t.colors.green900} />}
              onPress={message}
            />
          </View>
        ) : null}

        {u.bio ? (
          <Text variant="body" color="ink2" style={styles.bio}>
            {u.bio}
          </Text>
        ) : null}

        {expertProfile ? (
          <Card padded style={styles.expert}>
            <View style={styles.expertHead}>
              <Rating value={expertProfile.rating} count={expertProfile.ratingCount} />
              <Text variant="meta" color="muted">
                {tpr('userProfile.experiences', expertProfile.experienceCount)}
              </Text>
            </View>
            {expertProfile.specialties.length ? (
              <View style={styles.specialties}>
                {expertProfile.specialties.map((sp) => (
                  <Pill key={sp} label={sp} tone="brown" />
                ))}
              </View>
            ) : null}

            {experiences.data?.data.length ? (
              <View style={styles.expertList}>
                {experiences.data.data.map((e) => (
                  <RowCard
                    key={e.slug}
                    uri={e.coverUrl}
                    title={e.title}
                    subtitle={`${durationLabel(e.durationText)} · ${e.priceAzn} AZN`}
                    onPress={() => navigation.push('ExperienceDetail', { slug: e.slug })}
                  />
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        <View style={styles.tabs}>
          {(
            [
              ['posts', tr('userProfile.tabs.posts', { n: u.stats.posts })],
              ['routes', tr('userProfile.tabs.routes', { n: isMe && myRoutes.data ? myRoutes.data.data.length : u.stats.routes })],
              ['badges', tr('userProfile.tabs.badges', { n: u.stats.badges })],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
              <Text variant="small" color={tab === key ? 'green900' : 'muted'} style={styles.tabText}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {!u.canViewContent ? (
          <Card padded style={styles.locked}>
            <Icon name="lock" size={22} color={t.colors.muted} />
            <Text variant="small" color="ink2" style={styles.flex}>
              {tr('userProfile.locked')}
            </Text>
          </Card>
        ) : tab === 'posts' ? (
          posts.isLoading ? (
            <Loading />
          ) : postList.length === 0 ? (
            <Text variant="small" color="muted" center>
              {tr('userProfile.noPosts')}
            </Text>
          ) : (
            <View>
              <View style={styles.grid}>
                {postList.map((p) => (
                  <Pressable
                    key={p.publicId}
                    style={{ width: tile, height: tile }}
                    onPress={() => navigation.push('PostDetail', { publicId: p.publicId })}
                  >
                    {p.media[0] ? (
                      <Photo uri={p.media[0].url} style={{ width: tile, height: tile }} radius={t.radius.sm} />
                    ) : (
                      <View style={[styles.textTile, { width: tile, height: tile }]}>
                        <Text variant="caption" color="ink2" numberOfLines={5}>
                          {p.body}
                        </Text>
                      </View>
                    )}
                    {p.media.length > 1 ? (
                      <View style={styles.multi}>
                        <Icon name="image" size={12} color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
              {posts.hasNextPage ? (
                <Button
                  label={tr('common:actions.more')}
                  variant="ghost"
                  size="sm"
                  loading={posts.isFetchingNextPage}
                  onPress={() => void posts.fetchNextPage()}
                />
              ) : null}
            </View>
          )
        ) : tab === 'routes' ? (
          routes.isLoading ? (
            <Loading />
          ) : !routes.data?.data.length ? (
            isMe ? (
              <View style={styles.emptyRoutes}>
                <Text variant="small" color="muted" center>
                  {tr('userProfile.noRoutesMine')}
                </Text>
                <Button label={tr('userProfile.buildRoute')} variant="soft" size="sm" onPress={() => navigation.navigate('RouteBuilder')} />
              </View>
            ) : (
              <Text variant="small" color="muted" center>
                {tr('userProfile.noPublicRoutes')}
              </Text>
            )
          ) : (
            <View style={styles.list}>
              {routes.data.data.map((r) => (
                <RowCard
                  key={r.slug}
                  uri={r.coverUrl}
                  title={r.title}
                  subtitle={`${tpr('common:time.days', r.days)} · ${r.region.name}`}
                  meta={
                    <View style={styles.meta}>
                      {isMe && r.visibility === 'private' ? <Pill label={tr('userProfile.privateRoute')} tone="gray" /> : null}
                      {r.ratingCount > 0 ? <Rating value={r.rating} count={r.ratingCount} /> : null}
                      <Text variant="caption">{tpr('shared.stops', r.stopCount)}</Text>
                    </View>
                  }
                  onPress={() => navigation.navigate('RouteDetail', { slug: r.slug })}
                />
              ))}
            </View>
          )
        ) : badges.isLoading ? (
          <Loading />
        ) : (
          <View style={styles.badges}>
            {(badges.data?.badges ?? []).map((b) => (
              <View key={b.slug} style={[styles.badge, !b.earned && styles.badgeLocked]}>
                <View style={[styles.badgeIcon, b.earned && styles.badgeIconOn]}>
                  <Icon name="trophy" size={22} color={b.earned ? '#fff' : t.colors.muted} />
                </View>
                <Text variant="caption" center numberOfLines={1} style={styles.badgeName}>
                  {b.name}
                </Text>
                <Text variant="caption" center>
                  {b.earned ? tr('userProfile.earned') : `${b.percent}%`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  expert: { gap: t.spacing.md, marginBottom: t.spacing.lg },
  expertHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  expertList: { gap: t.spacing.md },
  flex: { flex: 1 },
  cover: { height: 170, backgroundColor: t.colors.green900 },
  coverImage: { width: '100%', height: 170 },
  coverShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,30,28,0.25)' },
  coverBar: { position: 'absolute', top: 44, left: 0, right: 0 },
  head: { alignItems: 'center', marginTop: -48, gap: 4, paddingHorizontal: t.spacing.page },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: t.spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 },
  body: { paddingHorizontal: t.spacing.page, marginTop: t.spacing.lg, gap: t.spacing.lg },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: t.spacing.md },
  bio: { lineHeight: 22 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.colors.line },
  tab: { flex: 1, alignItems: 'center', paddingVertical: t.spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: t.colors.green900 },
  tabText: { fontWeight: '600' },
  locked: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
  textTile: { borderRadius: t.radius.sm, backgroundColor: t.colors.green050, padding: t.spacing.sm },
  multi: { position: 'absolute', top: 6, right: 6 },
  list: { gap: t.spacing.md },
  emptyRoutes: { alignItems: 'center', gap: t.spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md },
  badge: { width: '30%', alignItems: 'center', gap: 4 },
  badgeLocked: { opacity: 0.6 },
  badgeIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.bg2,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeIconOn: { backgroundColor: t.colors.brown700 },
  badgeName: { fontWeight: '600' },
});
