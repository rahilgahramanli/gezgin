import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Icon, Loading, Photo, Pill, Text } from '@/components';
import {
  useConversation, useMessages, useReadConversation, useSendMessage, type ChatMessage,
} from '@/api/hooks/social';
import { emitRealtime, useSocketEvent } from '@/realtime/socket';
import { durationLabel } from '@/lib/labels';
import { clockTime, dayLabel, isSameDay, timeAgo } from '@/lib/time';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ardıcıl mesajlar qruplaşır — saat yalnız qrupun sonuncusunda görünür. */
const GROUP_GAP_MS = 5 * 60_000;

/** "yazır…" siqnalı hər düyməyə yox, bu intervalda bir göndərilir. */
const TYPING_THROTTLE_MS = 2500;
/** Qarşı tərəfdən siqnal kəsiləndə "yazır…" bu qədər sonra itir. */
const TYPING_TTL_MS = 4000;

/** Ekran 09 — söhbət. Mesajlar HTTP ilə gedir, socket ilə canlı gəlir. */
export function ChatScreen({ route, navigation }: AppScreenProps<'Chat'>) {
  const { publicId } = route.params;
  const insets = useSafeAreaInsets();
  const conv = useConversation(publicId);
  const messages = useMessages(publicId);
  const send = useSendMessage(publicId);
  const { mutate: markRead } = useReadConversation(publicId);

  const [text, setText] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const items = messages.data?.pages.flatMap((p) => p.data) ?? [];
  const newestId = items[0]?.publicId;
  const newestMine = items[0]?.isMine;

  // Açılanda və qarşı tərəfdən yeni mesaj gələndə oxunmuş et
  useEffect(() => {
    if (newestId && !newestMine) markRead();
  }, [newestId, newestMine, markRead]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  useSocketEvent<{ conversation: string; username: string; isTyping: boolean }>('typing', (e) => {
    if (e.conversation !== publicId) return;
    setTyping(e.isTyping ? e.username : null);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(null), TYPING_TTL_MS);
  });

  useSocketEvent<{ conversation: string; message: ChatMessage }>('message.new', (e) => {
    if (e.conversation === publicId && !e.message.isMine) setTyping(null);
  });

  const onChange = (value: string) => {
    setText(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > TYPING_THROTTLE_MS) {
      lastTypingSent.current = now;
      emitRealtime('typing', { conversation: publicId, isTyping: true });
    }
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    // Uğursuz olsa mətn itməsin
    send.mutate({ body }, { onError: () => setText(body) });
  };

  const other = conv.data?.other;
  const status = other
    ? [
        other.isLocalExpert ? 'Local Expert' : null,
        typing ? 'yazır…' : other.isOnline ? 'onlayn' : other.lastActiveAt ? `son aktivlik ${timeAgo(other.lastActiveAt)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={navigation.goBack} hitSlop={10} accessibilityLabel="Geri">
          <Icon name="chevronLeft" size={24} color={t.colors.ink} />
        </Pressable>
        <Pressable
          style={styles.headerUser}
          disabled={!other}
          onPress={() => other && navigation.navigate('UserProfile', { username: other.username })}
        >
          <Avatar uri={other?.avatarUrl} size={40} name={other?.fullName ?? 'GEZGIN Dəstək'} />
          <View style={styles.flex}>
            <Text variant="h3" numberOfLines={1}>
              {other?.fullName ?? 'GEZGIN Dəstək'}
            </Text>
            {status ? (
              <Text variant="caption" color={typing || other?.isOnline ? 'success' : 'muted'} numberOfLines={1}>
                {status}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {messages.isLoading ? (
          <Loading />
        ) : items.length === 0 ? (
          // Inverted siyahıda boş vəziyyət tərsinə çevrilir — ona görə siyahıdan kənarda
          <View style={styles.empty}>
            <Text variant="small" color="muted" center>
              Söhbətə salamla başla 👋
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            inverted
            keyExtractor={(m) => m.publicId}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => {
              // Siyahı tərsinədir: index+1 daha köhnə, index-1 daha yeni mesajdır
              const older = items[index + 1];
              const newer = items[index - 1];
              const startsDay = !older || !isSameDay(older.createdAt, item.createdAt);
              const endsGroup =
                !newer ||
                newer.isMine !== item.isMine ||
                new Date(newer.createdAt).getTime() - new Date(item.createdAt).getTime() > GROUP_GAP_MS;

              return (
                <View>
                  {startsDay ? (
                    <View style={styles.day}>
                      <Text variant="caption" color="muted">
                        {dayLabel(item.createdAt)}
                      </Text>
                    </View>
                  ) : null}
                  <Bubble
                    m={item}
                    showTime={endsGroup}
                    tight={!startsDay && !!older && older.isMine === item.isMine}
                    onOpenExperience={(slug) => navigation.navigate('ExperienceDetail', { slug })}
                    onBook={(slug) => navigation.navigate('Booking', { experience: slug })}
                    onOpenRoute={(slug) => navigation.navigate('RouteDetail', { slug })}
                  />
                </View>
              );
            }}
            onEndReached={() => {
              if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={messages.isFetchingNextPage ? <Loading /> : undefined}
          />
        )}

        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, t.spacing.md) }]}>
          {conv.data?.isBlocked ? (
            <Text variant="small" color="muted" center>
              Bu istifadəçi ilə yazışma mümkün deyil.
            </Text>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Mesaj yaz…"
                placeholderTextColor={t.colors.muted}
                value={text}
                onChangeText={onChange}
                multiline
                maxLength={4000}
              />
              <Pressable
                onPress={submit}
                disabled={!text.trim()}
                style={[styles.send, !text.trim() && styles.sendOff]}
                accessibilityLabel="Göndər"
              >
                <Icon name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({
  m,
  showTime,
  tight,
  onOpenExperience,
  onBook,
  onOpenRoute,
}: {
  m: ChatMessage;
  showTime: boolean;
  tight: boolean;
  onOpenExperience: (slug: string) => void;
  onBook: (slug: string) => void;
  onOpenRoute: (slug: string) => void;
}) {
  const payload = m.payload;

  let content: React.ReactNode;
  if (m.type === 'experience_card' && payload?.kind === 'experience') {
    content = (
      <View style={styles.cardBubble}>
        <Pressable onPress={() => onOpenExperience(payload.slug)}>
          <Photo uri={payload.imageUrl} style={styles.cardImage} radius={0} />
        </Pressable>
        <View style={styles.cardBody}>
          <Pill label="Təcrübə" tone="brown" />
          <Text variant="h3">{payload.title}</Text>
          <Text variant="caption">
            {[durationLabel(payload.durationText), payload.region, payload.rating ? `★ ${payload.rating.toFixed(1)}` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View style={styles.cardFooter}>
            <Text variant="h3" color="green900">
              {payload.priceAzn} AZN / nəfər
            </Text>
            <Button label="Bron et" size="xs" onPress={() => onBook(payload.slug)} />
          </View>
        </View>
      </View>
    );
  } else if (m.type === 'route_card' && payload?.kind === 'route') {
    content = (
      <Pressable style={styles.cardBubble} onPress={() => onOpenRoute(payload.slug)}>
        <Photo uri={payload.imageUrl} style={styles.cardImage} radius={0} />
        <View style={styles.cardBody}>
          <Pill label="Marşrut" tone="teal" />
          <Text variant="h3">{payload.title}</Text>
          <Text variant="caption">
            {payload.days} gün · {payload.stopCount} dayanacaq{payload.region ? ` · ${payload.region}` : ''}
          </Text>
        </View>
      </Pressable>
    );
  } else if (m.type === 'image') {
    content = <Photo uri={m.mediaUrl} style={styles.image} radius={t.radius.lg} />;
  } else {
    content = (
      <View style={[styles.bubble, m.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text variant="body" color={m.isMine ? 'paper' : 'ink'}>
          {m.body}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, m.isMine && styles.bubbleRowMine, tight && styles.bubbleRowTight]}>
      {content}
      {showTime ? (
        <Text variant="caption" style={styles.time}>
          {clockTime(m.createdAt)}
          {m.isMine && m.isRead ? ' · oxundu' : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.colors.bg },
  flex: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: t.colors.line,
  },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  list: { paddingHorizontal: t.spacing.page, paddingVertical: t.spacing.lg },
  day: { alignItems: 'center', marginVertical: t.spacing.lg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubbleRow: { alignItems: 'flex-start', gap: 3, maxWidth: '82%', marginTop: t.spacing.md },
  bubbleRowTight: { marginTop: 3 },
  bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMine: { backgroundColor: t.colors.green900, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: t.colors.bg2, borderBottomLeftRadius: 6 },
  time: { paddingHorizontal: 4 },
  image: { width: 220, height: 220, backgroundColor: t.colors.bg2 },
  cardBubble: {
    width: 250, borderRadius: t.radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: t.colors.line, backgroundColor: t.colors.paper,
  },
  cardImage: { width: 250, height: 130, backgroundColor: t.colors.bg2 },
  cardBody: { padding: t.spacing.md, gap: 4, alignItems: 'flex-start' },
  cardFooter: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  bar: {
    paddingHorizontal: t.spacing.page, paddingTop: t.spacing.sm,
    borderTopWidth: 1, borderTopColor: t.colors.line, backgroundColor: t.colors.bg,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm },
  input: {
    flex: 1, minHeight: 42, maxHeight: 120, paddingHorizontal: t.spacing.lg, paddingTop: 11, paddingBottom: 11,
    borderRadius: 21, backgroundColor: t.colors.bg2, color: t.colors.ink, fontSize: 15,
  },
  send: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
});
