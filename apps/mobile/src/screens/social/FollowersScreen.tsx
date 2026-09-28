import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, EmptyState, Loading, Screen, SectionHead, Text, TopBar } from '@/components';
import {
  useFollow, useFollowList, useSuggested, useUserProfile, type FollowRow, type SuggestedUser,
} from '@/api/hooks/social';
import { useUser } from '@/store/auth';
import { formatNumber } from '@/lib/time';
import { t } from '@/theme';
import { useT } from '@/i18n';
import type { AppScreenProps } from '@/navigation/types';

type Kind = 'followers' | 'following';

/** Ekran 42 — izləyicilər / izlədikləri; öz siyahında tövsiyələr də görünür. */
export function FollowersScreen({ route, navigation }: AppScreenProps<'Followers'>) {
  const { username } = route.params;
  const { t: tr } = useT('social');
  const me = useUser();
  const [kind, setKind] = useState<Kind>(route.params.tab ?? 'followers');
  const isMine = me?.username === username;

  const profile = useUserProfile(username);
  const list = useFollowList(username, kind);
  const suggested = useSuggested(isMine);
  const follow = useFollow();

  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;

  const toggle = (p: { username: string; isFollowing: boolean }) =>
    follow.mutate(
      { username: p.username, follow: !p.isFollowing },
      // Tövsiyələr optimistik yenilənmir — izləndikdən sonra siyahıdan çıxır; öz siyahımda
      // "İzləyir" sayı və siyahısı da yenilənir (əks halda yeni izlənən görünmürdü)
      {
        onSuccess: () => {
          void suggested.refetch();
          if (isMine) {
            void list.refetch();
            void profile.refetch();
          }
        },
      },
    );

  const person = (p: FollowRow | SuggestedUser, subtitle: string) => (
    <View key={p.username} style={styles.row}>
      <Pressable style={styles.person} onPress={() => navigation.push('UserProfile', { username: p.username })}>
        <Avatar uri={p.avatarUrl} size={48} name={p.fullName} />
        <View style={styles.flex}>
          <Text variant="h3" numberOfLines={1}>
            {p.fullName}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
      {'isMe' in p && p.isMe ? null : (
        <Button
          label={p.isFollowing ? tr('followers.followingButton') : tr('shared.follow')}
          size="xs"
          variant={p.isFollowing ? 'outline' : 'primary'}
          onPress={() => toggle(p)}
        />
      )}
    </View>
  );

  const subtitleOf = (p: FollowRow) =>
    `@${p.username} · ${p.isLocalExpert ? 'Local Expert' : tr('shared.level', { level: p.level })}`;

  return (
    <Screen padded={false} scroll={false}>
      <TopBar title={username} onBack={navigation.goBack} />

      <View style={styles.tabs}>
        {(
          [
            ['followers', tr('followers.tabFollowers'), profile.data?.stats.followers],
            ['following', tr('followers.tabFollowing'), profile.data?.stats.following],
          ] as const
        ).map(([key, label, count]) => (
          <Pressable key={key} onPress={() => setKind(key)} style={[styles.tab, kind === key && styles.tabActive]}>
            <Text variant="small" color={kind === key ? 'green900' : 'muted'} style={styles.tabText}>
              {label} {count !== undefined ? formatNumber(count) : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.username}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => person(item, subtitleOf(item))}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          ListEmptyComponent={
            <EmptyState
              title={
                total > 0
                  ? tr('followers.hiddenTitle')
                  : kind === 'followers'
                    ? tr('followers.noFollowers')
                    : tr('followers.noFollowing')
              }
              message={total > 0 ? tr('followers.hiddenMessage') : undefined}
            />
          }
          ListFooterComponent={
            isMine && suggested.data?.data.length ? (
              <View style={styles.suggested}>
                <SectionHead title={tr('followers.suggested')} />
                {suggested.data.data.map((s) =>
                  person(
                    s,
                    [s.region, s.isLocalExpert ? 'Local Expert' : tr('shared.level', { level: s.level })]
                      .filter(Boolean)
                      .join(' · '),
                  ),
                )}
              </View>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.colors.line, marginHorizontal: t.spacing.page },
  tab: { flex: 1, alignItems: 'center', paddingVertical: t.spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: t.colors.green900 },
  tabText: { fontWeight: '600' },
  list: { paddingHorizontal: t.spacing.page, paddingTop: t.spacing.md, paddingBottom: 40, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.sm },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  suggested: { marginTop: t.spacing.xl },
});
