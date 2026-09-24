import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Avatar, Chip, EmptyState, ListSkeleton, LogoMark, Pill, Screen, Text, TopBar } from '@/components';
import { useConversations, type ConversationFilter, type ConversationItem } from '@/api/hooks/social';
import { chatTime } from '@/lib/time';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

const FILTERS: Array<{ key: ConversationFilter; label: string }> = [
  { key: 'all', label: 'Hamısı' },
  { key: 'experts', label: 'Local Expert' },
  { key: 'business', label: 'Biznes' },
  { key: 'travelers', label: 'Gezginlər' },
];

/** Ekran 08 — söhbətlər, son mesaja görə. */
export function MessagesScreen({ navigation }: AppScreenProps<'Messages'>) {
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const list = useConversations(filter);

  return (
    <Screen padded={false} scroll={false}>
      <TopBar title="Mesajlar" onBack={navigation.goBack} />

      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>

      {list.isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={list.data?.data ?? []}
          keyExtractor={(c) => c.publicId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Row c={item} onPress={() => navigation.navigate('Chat', { publicId: item.publicId })} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="chat"
              title="Yazışma yoxdur"
              message='Gezgin və ya Local Expert profilində "Mesaj" düyməsinə toxun.'
            />
          }
          refreshControl={
            <RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={t.colors.green900} />
          }
        />
      )}
    </Screen>
  );
}

function Row({ c, onPress }: { c: ConversationItem; onPress: () => void }) {
  const unread = c.unreadCount > 0;
  return (
    <Pressable onPress={onPress} style={styles.row}>
      {c.other ? (
        <Avatar uri={c.other.avatarUrl} size={52} name={c.other.fullName} />
      ) : (
        <View style={styles.support}>
          <LogoMark size={26} color="#fff" />
        </View>
      )}
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Text variant="h3" numberOfLines={1} style={styles.shrink}>
            {c.title}
          </Text>
          {c.other?.isLocalExpert ? <Pill label="Local Expert" tone="brown" /> : null}
        </View>
        <Text variant="small" color={unread ? 'ink' : 'muted'} numberOfLines={1} style={unread && styles.bold}>
          {c.lastMessage?.preview ?? ''}
        </Text>
      </View>
      <View style={styles.side}>
        {c.lastMessage ? <Text variant="caption">{chatTime(c.lastMessage.at)}</Text> : null}
        {unread ? (
          <View style={styles.badge}>
            <Text variant="caption" color="paper" style={styles.bold}>
              {c.unreadCount}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.md },
  list: { paddingBottom: 40, flexGrow: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: t.spacing.md,
    paddingHorizontal: t.spacing.page, paddingVertical: t.spacing.md,
  },
  support: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  bold: { fontWeight: '700' },
  side: { alignItems: 'flex-end', gap: 6 },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: t.colors.green900, alignItems: 'center', justifyContent: 'center',
  },
});
