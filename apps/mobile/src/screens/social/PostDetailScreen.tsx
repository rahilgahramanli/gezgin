import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Card, EmptyState, Icon, Loading, Pill, PostCard, Text, TopBar } from '@/components';
import {
  useAddComment, useComments, useDeleteComment, useFollow, useLikeComment, useLikePost, usePost, useSavePost,
  type PostComment,
} from '@/api/hooks/social';
import { ApiError } from '@/api/client';
import { timeAgo } from '@/lib/time';
import { t } from '@/theme';
import { alertError, isGuestBlocked, promptGuestSignup } from '@/lib/errors';
import { useT } from '@/i18n';
import type { AppScreenProps } from '@/navigation/types';
import { ShareSheet } from './ShareSheet';

/** Ekran 06 — paylaşım detalı, məkan kartı və bir səviyyəli şərh ağacı. */
export function PostDetailScreen({ route, navigation }: AppScreenProps<'PostDetail'>) {
  const { publicId, focusComment } = route.params;
  const { t: tr, tp: tpr } = useT('social');
  const insets = useSafeAreaInsets();
  const post = usePost(publicId);
  const comments = useComments(publicId);
  const like = useLikePost();
  const save = useSavePost();
  const follow = useFollow();
  const add = useAddComment(publicId);
  const remove = useDeleteComment(publicId);
  const likeComment = useLikeComment(publicId);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ publicId: string; name: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  /** Yeni kök şərh siyahının sonuna düşür — göndərəndən sonra ora sürüşdürürük ki, görünsün. */
  const scrollToNewComment = useRef(false);

  // Lentdə şərh ikonuna toxunulubsa klaviatura dərhal açılır
  useEffect(() => {
    if (!focusComment) return;
    const timer = setTimeout(() => input.current?.focus(), 450);
    return () => clearTimeout(timer);
  }, [focusComment]);

  if (post.isLoading) return <Loading label={tr('common:states.loading')} />;
  if (!post.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar onBack={navigation.goBack} />
        <EmptyState title={tr('postDetail.notFoundTitle')} message={tr('postDetail.notFoundMessage')} />
      </SafeAreaView>
    );
  }

  const p = post.data;
  const place = p.place;
  const linkedRoute = p.route;
  const list = comments.data?.pages.flatMap((pg) => pg.data) ?? [];
  const error = add.error instanceof ApiError ? add.error.message : null;

  const reply = (c: PostComment) => {
    setReplyTo({ publicId: c.publicId, name: c.author.fullName.split(' ')[0] ?? c.author.username });
    input.current?.focus();
  };

  const submit = () => {
    const body = text.trim();
    if (!body || add.isPending) return;
    add.mutate(
      { body, ...(replyTo ? { parent: replyTo.publicId } : {}) },
      {
        onSuccess: () => {
          setText('');
          setReplyTo(null);
          scrollToNewComment.current = !replyTo;
        },
        onError: (e) => {
          if (isGuestBlocked(e)) promptGuestSignup(tr('postDetail.commentGuest'));
        },
      },
    );
  };

  const confirmRemove = (c: PostComment) =>
    Alert.alert(
      tr('postDetail.deleteTitle'),
      c.replies.length ? tr('postDetail.deleteWithReplies') : tr('postDetail.deleteMessage'),
      [
        { text: tr('common:actions.cancel'), style: 'cancel' },
        {
          text: tr('common:actions.delete'),
          style: 'destructive',
          onPress: () => remove.mutate(c.publicId, { onError: (e) => alertError(e, tr('postDetail.deleteFailed')) }),
        },
      ],
    );

  const renderComment = (c: PostComment, isReply = false) => (
    <View key={c.publicId} style={[styles.comment, isReply && styles.reply]}>
      <Pressable onPress={() => navigation.push('UserProfile', { username: c.author.username })}>
        <Avatar uri={c.author.avatarUrl} size={isReply ? 28 : 36} name={c.author.fullName} />
      </Pressable>
      <View style={styles.flex}>
        <View style={styles.commentHead}>
          <Text variant="h3" style={styles.commentName}>
            {c.author.fullName.split(' ')[0]}
          </Text>
          {c.author.isLocalExpert ? <Pill label="Local Expert" tone="brown" /> : null}
          <Text variant="caption">{timeAgo(c.createdAt)}</Text>
        </View>
        <Text variant="small" color="ink2" style={styles.commentBody}>
          {c.body}
        </Text>
        <View style={styles.commentActions}>
          <Text variant="caption" color="green900" style={styles.bold} onPress={() => reply(c)}>
            {tr('postDetail.reply')}
          </Text>
          {c.likeCount > 0 ? <Text variant="caption">{tpr('postDetail.likes', c.likeCount)}</Text> : null}
          {c.canDelete ? (
            <Text variant="caption" color="danger" onPress={() => confirmRemove(c)}>
              {tr('common:actions.delete')}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable
        hitSlop={10}
        accessibilityLabel={c.liked ? tr('postDetail.unlikeComment') : tr('postDetail.likeComment')}
        onPress={() =>
          likeComment.mutate({ publicId: c.publicId, like: !c.liked }, { onError: (e) => alertError(e, tr('common:feedback.likeFailed')) })
        }
      >
        <Icon name="heart" size={16} color={c.liked ? t.colors.danger : t.colors.muted} filled={c.liked} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={tr('postDetail.title')} onBack={navigation.goBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroller}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!scrollToNewComment.current) return;
            scrollToNewComment.current = false;
            scroller.current?.scrollToEnd({ animated: true });
          }}
        >
          {!p.viewer.isMine ? (
            <View style={styles.followRow}>
              <Text variant="small" color="muted" style={styles.flex}>
                {tr('postDetail.authorLevel', { name: p.author.fullName, level: p.author.level })}
              </Text>
              <Button
                label={p.viewer.followsAuthor ? tr('shared.youFollow') : tr('shared.follow')}
                size="xs"
                variant={p.viewer.followsAuthor ? 'outline' : 'primary'}
                loading={follow.isPending}
                onPress={() =>
                  follow.mutate(
                    { username: p.author.username, follow: !p.viewer.followsAuthor },
                    { onSuccess: () => void post.refetch() },
                  )
                }
              />
            </View>
          ) : null}

          <PostCard
            post={p}
            full
            onAuthor={() => navigation.push('UserProfile', { username: p.author.username })}
            onPlace={() => place && navigation.navigate('PlaceDetail', { slug: place.slug })}
            onLike={() => like.mutate({ publicId: p.publicId, like: !p.viewer.liked })}
            onSave={() => save.mutate({ publicId: p.publicId, save: !p.viewer.saved })}
            onComment={() => input.current?.focus()}
            onShare={() => setSharing(true)}
          />

          {place ? (
            <Card padded style={styles.linkCard} onPress={() => navigation.navigate('PlaceDetail', { slug: place.slug })}>
              <View style={styles.linkIcon}>
                <Icon name="pin" size={18} color={t.colors.green900} />
              </View>
              <View style={styles.flex}>
                <Text variant="h3">{place.name}</Text>
                <Text variant="caption">
                  {[place.region, place.rating ? `★ ${place.rating.toFixed(1)}` : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text variant="small" color="green900" style={styles.bold}>
                {tr('postDetail.view')}
              </Text>
            </Card>
          ) : null}

          {linkedRoute ? (
            <Card padded style={styles.linkCard} onPress={() => navigation.navigate('RouteDetail', { slug: linkedRoute.slug })}>
              <View style={styles.linkIcon}>
                <Icon name="route" size={18} color={t.colors.green900} />
              </View>
              <View style={styles.flex}>
                <Text variant="h3">{linkedRoute.title}</Text>
                <Text variant="caption">{tpr('postDetail.routeDays', linkedRoute.days)}</Text>
              </View>
              <Text variant="small" color="green900" style={styles.bold}>
                {tr('postDetail.view')}
              </Text>
            </Card>
          ) : null}

          <Text variant="h2" style={styles.commentsTitle}>
            {tr('postDetail.comments', { n: p.counts.comments })}
          </Text>
          {comments.isLoading ? (
            <Loading />
          ) : list.length === 0 ? (
            <Text variant="small" color="muted">
              {tr('postDetail.firstComment')}
            </Text>
          ) : (
            list.map((c) => (
              <View key={c.publicId}>
                {renderComment(c)}
                {c.replies.map((r) => renderComment(r, true))}
              </View>
            ))
          )}
          {comments.hasNextPage ? (
            <Button
              label={tr('postDetail.moreComments')}
              variant="ghost"
              size="sm"
              loading={comments.isFetchingNextPage}
              onPress={() => void comments.fetchNextPage()}
            />
          ) : null}
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, t.spacing.md) }]}>
          {replyTo ? (
            <View style={styles.replying}>
              <Icon name="reply" size={14} color={t.colors.muted} />
              <Text variant="caption" style={styles.flex}>
                {tr('postDetail.replyingTo', { name: replyTo.name })}
              </Text>
              <Pressable hitSlop={10} onPress={() => setReplyTo(null)}>
                <Icon name="x" size={14} color={t.colors.muted} />
              </Pressable>
            </View>
          ) : null}
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              ref={input}
              style={styles.input}
              placeholder={tr('postDetail.placeholder')}
              placeholderTextColor={t.colors.muted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
            <Pressable
              onPress={submit}
              disabled={!text.trim() || add.isPending}
              style={[styles.send, (!text.trim() || add.isPending) && styles.sendOff]}
              accessibilityLabel={tr('shared.send')}
            >
              <Icon name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ShareSheet post={sharing ? p : null} onClose={() => setSharing(false)} onDeleted={() => navigation.goBack()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.colors.bg },
  flex: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.xxl, gap: t.spacing.lg },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  linkIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  bold: { fontWeight: '600' },
  commentsTitle: { marginTop: t.spacing.sm },
  comment: { flexDirection: 'row', gap: t.spacing.md, paddingVertical: t.spacing.sm },
  reply: { marginLeft: 48 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  commentName: { fontSize: 14 },
  commentBody: { marginTop: 2, lineHeight: 20 },
  commentActions: { flexDirection: 'row', gap: t.spacing.md, marginTop: 4 },
  bar: {
    paddingHorizontal: t.spacing.page, paddingTop: t.spacing.sm, gap: 6,
    borderTopWidth: 1, borderTopColor: t.colors.line, backgroundColor: t.colors.bg,
  },
  replying: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm },
  input: {
    flex: 1, minHeight: 42, maxHeight: 110, paddingHorizontal: t.spacing.lg, paddingTop: 11, paddingBottom: 11,
    borderRadius: 21, backgroundColor: t.colors.bg2, color: t.colors.ink, fontSize: 15,
  },
  send: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
});
