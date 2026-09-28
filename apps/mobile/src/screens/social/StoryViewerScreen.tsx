import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Icon, Loading, Photo, Text } from '@/components';
import { socialKeys, useDeleteStory, useUserStories, useViewStory } from '@/api/hooks/social';
import { useUser } from '@/store/auth';
import { alertError } from '@/lib/errors';
import { timeAgo } from '@/lib/time';
import { useT } from '@/i18n';
import type { AppScreenProps } from '@/navigation/types';

/** Hər hekayə bu qədər göstərilir, sonra növbətiyə keçir. */
const STORY_MS = 5000;

/** Ekran 40 — hekayə baxışı: yuxarıda tərəqqi zolaqları, sağa/sola toxunuş. */
export function StoryViewerScreen({ route, navigation }: AppScreenProps<'StoryViewer'>) {
  const { username } = route.params;
  const { t: tr, tp: tpr } = useT('social');
  const qc = useQueryClient();
  const stories = useUserStories(username);
  const { mutate: markViewed } = useViewStory();
  const removeStory = useDeleteStory();
  const me = useUser();
  const [index, setIndex] = useState(0);
  /** Silmə təsdiqi açıq olanda taymer dayanır — hekayə alertin arxasında keçib getməsin. */
  const [paused, setPaused] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const list = stories.data?.data ?? [];
  const current = list[index];

  // Dairələrin "baxıldı" vəziyyəti ekran bağlananda bir dəfə yenilənir
  useEffect(
    () => () => {
      void qc.invalidateQueries({ queryKey: socialKeys.stories });
    },
    [qc],
  );

  // Deep link ilə birbaşa açılıbsa geri gediləcək ekran yoxdur
  const close = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs');
  }, [navigation]);

  const next = useCallback(() => {
    if (index < list.length - 1) setIndex((i) => i + 1);
    else close();
  }, [index, list.length, close]);

  const prev = () => {
    if (index > 0) setIndex((i) => i - 1);
    else progress.setValue(0);
  };

  useEffect(() => {
    if (!current || paused) return;
    if (!current.viewed) markViewed(current.publicId);
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: STORY_MS, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) next();
    });
    return () => anim.stop();
  }, [current, next, progress, markViewed, paused]);

  const confirmDelete = () => {
    if (!current) return;
    setPaused(true);
    Alert.alert(tr('story.delete'), tr('story.deleteMessage'), [
      { text: tr('common:actions.cancel'), style: 'cancel', onPress: () => setPaused(false) },
      {
        text: tr('common:actions.delete'),
        style: 'destructive',
        onPress: () =>
          removeStory.mutate(current.publicId, {
            onSuccess: () => {
              void stories.refetch().then((r) => {
                const left = r.data?.data.length ?? 0;
                if (!left) close();
                else setIndex((i) => Math.min(i, left - 1));
                setPaused(false);
              });
            },
            onError: (e) => {
              setPaused(false);
              alertError(e, tr('story.deleteFailed'));
            },
          }),
      },
    ]);
  };

  if (stories.isLoading) return <Loading label={tr('common:states.loading')} />;

  if (!current || !stories.data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text variant="h3" color="paper">
            {tr('story.empty')}
          </Text>
          <Button label={tr('common:actions.close')} variant="light" size="sm" onPress={close} />
        </View>
      </SafeAreaView>
    );
  }

  const author = stories.data.user;
  const isMine = !!me && author.username === me.username;

  return (
    <View style={styles.root}>
      <Photo uri={current.mediaUrl} style={styles.media} radius={0} />
      <Shade position="top" />
      <Shade position="bottom" />

      {/* Sol üçdə bir — geri, qalan — irəli */}
      <View style={styles.taps}>
        <Pressable style={styles.tapLeft} onPress={prev} accessibilityLabel={tr('story.prev')} />
        <Pressable style={styles.tapRight} onPress={next} accessibilityLabel={tr('story.next')} />
      </View>

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.bars}>
          {list.map((s, i) => (
            <View key={s.publicId} style={styles.bar}>
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    width:
                      i < index
                        ? '100%'
                        : i === index
                          ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                          : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.head} pointerEvents="box-none">
          <Pressable
            style={styles.author}
            onPress={() => navigation.replace('UserProfile', { username: author.username })}
          >
            <Avatar uri={author.avatarUrl} size={34} name={author.fullName} />
            <Text variant="h3" color="paper">
              {author.fullName.split(' ')[0]}
            </Text>
            <Text variant="caption" style={styles.dim}>
              {timeAgo(current.createdAt)}
            </Text>
          </Pressable>
          <Pressable onPress={close} hitSlop={12} accessibilityLabel={tr('common:actions.close')}>
            <Icon name="x" size={26} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.foot} pointerEvents="box-none">
          {current.place ? (
            <Pressable
              style={styles.place}
              onPress={() => {
                const slug = current.place?.slug;
                if (slug) navigation.replace('PlaceDetail', { slug });
              }}
            >
              <Icon name="pin" size={14} color="#fff" />
              <Text variant="small" color="paper">
                {[current.place.name, current.place.region].filter(Boolean).join(', ')}
              </Text>
            </Pressable>
          ) : null}
          {current.caption ? (
            <Text variant="h2" color="paper">
              {current.caption}
            </Text>
          ) : null}
          {current.viewCount !== undefined || isMine ? (
            <View style={styles.views}>
              {current.viewCount !== undefined ? (
                <>
                  <Icon name="eye" size={16} color="#fff" />
                  <Text variant="small" color="paper" style={styles.flexText}>
                    {tpr('story.views', current.viewCount)}
                  </Text>
                </>
              ) : (
                <View style={styles.flexText} />
              )}
              {isMine ? (
                <Pressable onPress={confirmDelete} hitSlop={12} accessibilityRole="button" accessibilityLabel={tr('story.delete')}>
                  <Icon name="trash" size={20} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Yuxarı və aşağıda yumşaq kölgə — ağ mətn açıq fotoda da oxunsun. */
function Shade({ position }: { position: 'top' | 'bottom' }) {
  const id = `story-shade-${position}`;
  const top = position === 'top';
  return (
    <Svg style={top ? styles.shadeTop : styles.shadeBottom} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1={top ? '0' : '1'} x2="0" y2={top ? '1' : '0'}>
          <Stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1, backgroundColor: '#000' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  media: { ...fill, width: '100%', height: '100%' },
  shadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  shadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300 },
  taps: { ...fill, flexDirection: 'row' },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  overlay: { ...fill, justifyContent: 'space-between' },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 12 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dim: { color: 'rgba(255,255,255,0.8)' },
  foot: { flex: 1, justifyContent: 'flex-end', gap: 10, paddingHorizontal: 20, paddingBottom: 24 },
  place: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  views: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flexText: { flex: 1 },
});
