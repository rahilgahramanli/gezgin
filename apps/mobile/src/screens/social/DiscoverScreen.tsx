import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar, Button, EmptyState, Icon, Loading, PhotoCard, PostCard, PostSkeleton, SectionHead, Text, type IconName,
} from '@/components';
import { useExperiences } from '@/api/hooks/content';
import { useMe } from '@/api/hooks/me';
import {
  useChatBadge, useFeed, useLikePost, useNotificationBadge, useSavePost, useStoryRings, type FeedTab, type Post,
} from '@/api/hooks/social';
import { getCurrentPosition, type Coords } from '@/lib/location';
import { t } from '@/theme';
import { errorText } from '@/lib/errors';
import { useT } from '@/i18n';
import type { TabScreenProps } from '@/navigation/types';
import { ShareSheet } from './ShareSheet';

// Mənbə dizaynda başlıqlar ingiliscə idi; interfeysin qalanı azərbaycanca
// olduğu üçün naviqasiya da tərcümə olundu — qarışıq dil "şablon" hissi verirdi.
// Etiketlər render zamanı `social:discover.tabs.<key>`-dən gəlir — dil dəyişəndə yenilənsin.
const TABS: FeedTab[] = ['for_you', 'following', 'nearby'];

/** Ekran 05 — sosial lent: hekayə dairələri, üç tab, paylaşımlar. */
export function DiscoverScreen({ navigation }: TabScreenProps<'Discover'>) {
  const { t: tr } = useT('social');
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - t.spacing.page * 2;
  const [tab, setTab] = useState<FeedTab>('for_you');
  const [near, setNear] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [sharing, setSharing] = useState<Post | null>(null);

  const me = useMe();
  const feed = useFeed(tab, near);
  const rings = useStoryRings();
  const experiences = useExperiences({ sort: 'popular', limit: 6 });
  const unread = useNotificationBadge();
  const chatUnread = useChatBadge();
  const like = useLikePost();
  const save = useSavePost();

  const locate = async () => {
    setLocating(true);
    const coords = await getCurrentPosition();
    setLocating(false);
    if (coords) setNear(coords);
  };

  const selectTab = (next: FeedTab) => {
    setTab(next);
    if (next === 'nearby' && !near) void locate();
  };

  const posts = feed.data?.pages.flatMap((p) => p.data) ?? [];
  const myRing = rings.data?.data.find((r) => r.isMine);
  const others = rings.data?.data.filter((r) => !r.isMine) ?? [];
  const myUsername = me.data?.username;

  const header = (
    <View style={styles.header}>
      <View style={styles.top}>
        <Text variant="titleLg">{tr('discover.title')}</Text>
        <View style={styles.topActions}>
          <IconButton icon="bell" label={tr('discover.notifications')} dot={(unread.data ?? 0) > 0} onPress={() => navigation.navigate('Notifications')} />
          <IconButton icon="chat" label={tr('discover.messages')} dot={(chatUnread.data ?? 0) > 0} onPress={() => navigation.navigate('Messages')} />
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((key) => {
          const active = tab === key;
          return (
            <Pressable key={key} onPress={() => selectTab(key)} style={[styles.tab, active && styles.tabActive]}>
              <Text variant="small" color={active ? 'paper' : 'ink2'} style={styles.tabText}>
                {tr(`discover.tabs.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
        {/* Öz dairən — hekayən yoxdursa "+" yaratmağa aparır */}
        <Pressable
          style={styles.story}
          onPress={() =>
            myRing && myUsername
              ? navigation.navigate('StoryViewer', { username: myUsername })
              : navigation.navigate('CreatePost', { mode: 'story' })
          }
        >
          <View>
            <Avatar
              uri={me.data?.avatarUrl}
              name={me.data?.fullName}
              size={60}
              ring={!!myRing}
              ringColor={myRing?.hasUnseen ? t.colors.green900 : t.colors.line}
            />
            {!myRing ? (
              <View style={styles.plus}>
                <Icon name="plus" size={12} color="#fff" strokeWidth={3} />
              </View>
            ) : null}
          </View>
          <Text variant="caption" numberOfLines={1}>
            {tr('discover.you')}
          </Text>
        </Pressable>

        {others.map((r) => (
          <Pressable
            key={r.user.username}
            style={styles.story}
            onPress={() => navigation.navigate('StoryViewer', { username: r.user.username })}
          >
            <Avatar
              uri={r.user.avatarUrl}
              name={r.user.fullName}
              size={60}
              ring
              ringColor={r.hasUnseen ? t.colors.green900 : t.colors.line}
            />
            <Text variant="caption" numberOfLines={1}>
              {r.user.fullName.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const empty =
    tab === 'nearby' && locating ? (
      <Loading label={tr('discover.locating')} />
    ) : tab === 'nearby' && !near ? (
      <EmptyState
        icon="navigation"
        title={tr('discover.whereTitle')}
        message={tr('discover.whereMessage')}
        action={<Button label={tr('common:location.allow')} variant="soft" size="sm" onPress={() => void locate()} />}
      />
    ) : feed.isError ? (
      // Oflayn/server xətası "Lent hələ boşdur" kimi görünməsin
      <EmptyState
        icon="wifiOff"
        title={tr('discover.loadFailed')}
        message={errorText(feed.error, tr('common:states.tryLater'))}
        action={<Button label={tr('common:actions.retry')} variant="soft" size="sm" onPress={() => void feed.refetch()} />}
      />
    ) : feed.isLoading ? (
      // Spinner əvəzinə kartın forması — ekran "sıçramır"
      <View>
        <PostSkeleton width={cardWidth} />
        <PostSkeleton width={cardWidth} />
      </View>
    ) : tab === 'following' ? (
      <EmptyState
        icon="users"
        title={tr('discover.followingEmptyTitle')}
        message={tr('discover.followingEmptyMessage')}
        action={
          myUsername ? (
            <Button
              label={tr('discover.findTravellers')}
              variant="soft"
              size="sm"
              onPress={() => navigation.navigate('Followers', { username: myUsername, tab: 'following' })}
            />
          ) : null
        }
      />
    ) : (
      <EmptyState
        icon="compass"
        title={tab === 'nearby' ? tr('discover.nearbyEmptyTitle') : tr('discover.emptyTitle')}
        message={tab === 'nearby' ? tr('discover.nearbyEmptyMessage') : tr('discover.emptyMessage')}
      />
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.publicId}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <View>
            <PostCard
              post={item}
              onOpen={() => navigation.navigate('PostDetail', { publicId: item.publicId })}
              onComment={() => navigation.navigate('PostDetail', { publicId: item.publicId, focusComment: true })}
              onAuthor={() => navigation.navigate('UserProfile', { username: item.author.username })}
              onPlace={() => item.place && navigation.navigate('PlaceDetail', { slug: item.place.slug })}
              onLike={() => like.mutate({ publicId: item.publicId, like: !item.viewer.liked })}
              onSave={() => save.mutate({ publicId: item.publicId, save: !item.viewer.saved })}
              onShare={() => setSharing(item)}
            />

            {/* Ekran 05: birinci paylaşımdan sonra "Populyar təcrübələr" zolağı */}
            {index === 0 && tab === 'for_you' && experiences.data?.data.length ? (
              <View style={styles.strip}>
                <SectionHead
                  title={tr('discover.popularExperiences')}
                  actionLabel={tr('shared.all')}
                  onAction={() => navigation.navigate('Experiences')}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
                  {experiences.data.data.map((e) => (
                    <PhotoCard
                      key={e.slug}
                      uri={e.coverUrl}
                      title={e.title}
                      subtitle={`${e.priceAzn} AZN · ${e.region.name}`}
                      // Rəyi olmayan təcrübədə "★ 0.0" yanıltıcıdır
                      rating={e.ratingCount ? e.rating : undefined}
                      width={200}
                      height={150}
                      onPress={() => navigation.navigate('ExperienceDetail', { slug: e.slug })}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        ListFooterComponent={feed.isFetchingNextPage ? <Loading /> : undefined}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => {
              void feed.refetch();
              void rings.refetch();
            }}
            tintColor={t.colors.green900}
          />
        }
      />

      <ShareSheet post={sharing} onClose={() => setSharing(null)} />
    </SafeAreaView>
  );
}

function IconButton({ icon, label, dot, onPress }: { icon: IconName; label: string; dot?: boolean; onPress: () => void }) {
  const { t: tr } = useT('social');
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.iconBtn}
      accessibilityRole="button"
      accessibilityLabel={dot ? tr('discover.unreadA11y', { label }) : label}
    >
      <Icon name={icon} size={24} color={t.colors.ink} />
      {dot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.colors.bg },
  list: { paddingHorizontal: t.spacing.page, paddingBottom: 40, flexGrow: 1 },
  header: { gap: t.spacing.lg, marginBottom: t.spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm },
  topActions: { flexDirection: 'row', gap: t.spacing.lg },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute', top: 3, right: 3, width: 9, height: 9, borderRadius: 5,
    backgroundColor: t.colors.danger, borderWidth: 1.5, borderColor: t.colors.bg,
  },
  tabs: { flexDirection: 'row', backgroundColor: t.colors.bg2, borderRadius: t.radius.pill, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: t.radius.pill },
  tabActive: { backgroundColor: t.colors.green900 },
  tabText: { fontWeight: '600' },
  stories: { gap: t.spacing.md, paddingRight: t.spacing.page },
  story: { alignItems: 'center', gap: 4, width: 68 },
  plus: {
    position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11,
    backgroundColor: t.colors.green900, borderWidth: 2, borderColor: t.colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  separator: { height: 1, backgroundColor: t.colors.line, marginVertical: t.spacing.xl },
  strip: { marginTop: t.spacing.xl },
  hscroll: { gap: t.spacing.md, paddingRight: t.spacing.page },
});
