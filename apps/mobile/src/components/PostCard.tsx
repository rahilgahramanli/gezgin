import { useState } from 'react';
import { useT } from '@/i18n';
import {
  Pressable, ScrollView, StyleSheet, View, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import type { Post } from '@/api/hooks/social';
import { compactCount, timeAgo } from '@/lib/time';
import { t } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Avatar, Photo } from './Media';
import { Pill } from './Pill';
import { Text } from './Text';
import { kmLabel } from '@/lib/labels';

/**
 * Heşteq sərhədi — `\p{L}` əvəzinə "boşluq və durğu işarəsi olmayan" sinif:
 * Hermes-də Unicode property escape dəstəyinə güvənmirik (modul yüklənərkən
 * SyntaxError tətbiqi açılışda sındırardı). Azərbaycan hərfləri də tutulur.
 */
const HASHTAG = /(#[^\s#.,!?;:()"'“”«»]+)/g;

/** Mətn + yaşıl heşteqlər — ekran 05, 06. */
export function RichBody({
  author,
  body,
  numberOfLines,
}: {
  author?: string;
  body: string;
  numberOfLines?: number;
}) {
  const parts = body.split(HASHTAG);
  return (
    <Text variant="body" numberOfLines={numberOfLines}>
      {author ? (
        <Text variant="body" style={styles.bold}>
          {author}{' '}
        </Text>
      ) : null}
      {parts.map((part, i) =>
        part.startsWith('#') ? (
          <Text key={i} variant="body" color="green900" style={styles.tag}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

export interface PostCardProps {
  post: Post;
  /** Detal ekranı: mətn tam, "şərhlərə bax" linki yoxdur. */
  full?: boolean;
  onOpen?: () => void;
  onAuthor?: () => void;
  onPlace?: () => void;
  onLike: () => void;
  onComment?: () => void;
  onShare: () => void;
  onSave: () => void;
}

/** Ekran 05 lent kartı: müəllif, foto karuseli, düymələr, mətn. */
export function PostCard({ post, full, onOpen, onAuthor, onPlace, onLike, onComment, onShare, onSave }: PostCardProps) {
  const { t: tr, tp: tpr } = useT();
  const { width: screen } = useWindowDimensions();
  const width = screen - t.spacing.page * 2;

  const meta = [post.location, timeAgo(post.createdAt), post.distanceKm != null ? kmLabel(post.distanceKm) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable onPress={onAuthor} style={styles.author} hitSlop={4}>
          <Avatar uri={post.author.avatarUrl} size={40} name={post.author.fullName} />
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <Text variant="h3" numberOfLines={1} style={styles.shrink}>
                {post.author.username}
              </Text>
              {post.author.isLocalExpert ? <Pill label="Local Expert" tone="brown" /> : null}
              {post.visibility !== 'public' ? (
                <Icon name={post.visibility === 'private' ? 'lock' : 'users'} size={14} color={t.colors.muted} />
              ) : null}
            </View>
            <Text variant="caption" numberOfLines={1}>
              {meta}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={onShare} hitSlop={12} accessibilityLabel={tr('actions.more')}>
          <Icon name="more" size={22} color={t.colors.muted} strokeWidth={3} />
        </Pressable>
      </View>

      {post.media.length ? (
        <Carousel post={post} width={width} onPress={onOpen} onPlace={onPlace} />
      ) : null}

      <View style={styles.actions}>
        <Action
          icon="heart"
          count={post.counts.likes}
          active={post.viewer.liked}
          activeColor={t.colors.danger}
          onPress={onLike}
          label={post.viewer.liked ? tr('actions.unlike') : tr('actions.like')}
        />
        <Action icon="chat" count={post.counts.comments} onPress={onComment ?? onOpen} label={tr('actions.comments')} />
        <Action icon="share" count={post.counts.shares} onPress={onShare} label={tr('actions.share')} />
        <View style={styles.flex} />
        <Pressable onPress={onSave} hitSlop={10} accessibilityLabel={post.viewer.saved ? tr('actions.saved') : tr('actions.saveItem')}>
          <Icon
            name="bookmark"
            size={22}
            color={post.viewer.saved ? t.colors.green900 : t.colors.ink}
            filled={post.viewer.saved}
          />
        </Pressable>
      </View>

      {post.body ? (
        <Pressable onPress={onOpen} disabled={full || !onOpen}>
          <RichBody author={post.author.username} body={post.body} numberOfLines={full ? undefined : 3} />
        </Pressable>
      ) : null}

      {!full && post.counts.comments > 0 ? (
        <Text variant="small" color="muted" onPress={onComment ?? onOpen}>
          {tpr('post.allComments', post.counts.comments)}
        </Text>
      ) : null}
    </View>
  );
}

function Carousel({
  post,
  width,
  onPress,
  onPlace,
}: {
  post: Post;
  width: number;
  onPress?: () => void;
  onPlace?: () => void;
}) {
  const [index, setIndex] = useState(0);
  // 4:5 — dizayndakı portret kart nisbəti
  const height = Math.round(width * 1.15);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={[styles.carousel, { width, height }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        scrollEnabled={post.media.length > 1}
      >
        {post.media.map((m, i) => (
          <Pressable key={`${m.url}-${i}`} onPress={onPress}>
            <Photo uri={m.url} style={{ width, height }} radius={0} />
          </Pressable>
        ))}
      </ScrollView>

      {post.media.length > 1 ? (
        <View style={styles.counter}>
          <Text variant="caption" style={styles.onPhoto}>
            {index + 1}/{post.media.length}
          </Text>
        </View>
      ) : null}

      {post.place ? (
        <Pressable onPress={onPlace} style={styles.placeTag}>
          <Icon name="pin" size={13} color="#fff" />
          <Text variant="caption" style={styles.onPhoto} numberOfLines={1}>
            {post.place.name}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Action({
  icon,
  count,
  active,
  activeColor,
  onPress,
  label,
}: {
  icon: IconName;
  count: number;
  active?: boolean;
  activeColor?: string;
  onPress?: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} color={active ? activeColor : t.colors.ink} filled={active} />
      {count > 0 ? <Text variant="small">{compactCount(count)}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: t.spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  flex: { flex: 1, minWidth: 0 },
  carousel: { borderRadius: t.radius.lg, overflow: 'hidden', backgroundColor: t.colors.bg2 },
  counter: {
    position: 'absolute', top: t.spacing.md, right: t.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: t.radius.pill,
  },
  placeTag: {
    position: 'absolute', left: t.spacing.md, bottom: t.spacing.md, maxWidth: '70%',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: t.radius.pill,
  },
  onPhoto: { color: '#fff', fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pressed: { opacity: 0.45 },
  bold: { fontWeight: '700' },
  tag: { fontWeight: '500' },
});
