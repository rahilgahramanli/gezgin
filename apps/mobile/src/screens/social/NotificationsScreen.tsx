import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Avatar, Chip, EmptyState, Icon, Loading, Photo, Screen, Text, TopBar, type IconName } from '@/components';
import {
  useNotifications, useReadAllNotifications, useReadNotification, type AppNotification,
} from '@/api/hooks/social';
import { useDeepLink } from '@/lib/deepLink';
import { timeAgo } from '@/lib/time';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

type Tab = 'all' | 'social' | 'system';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'all', label: 'Hamısı' },
  { key: 'social', label: 'Sosial' },
  { key: 'system', label: 'Sistem' },
];

/** Sistem bildirişlərinin ikonları — aktyor olmayanda avatar yerinə. */
const SYSTEM_ICON: Record<string, IconName> = {
  badge_earned: 'trophy',
  level_up: 'sparkle',
  xp_gained: 'sparkle',
  booking_update: 'calendar',
  payment_update: 'coins',
  event_reminder: 'calendar',
  trip_reminder: 'map',
};

/**
 * Ekran 07 — sosial və sistem bildirişləri.
 * Dizayndakı "Xüsusi təkliflər" və "Gələcək tədbirlər" Sprint 9-dadır (events).
 */
export function NotificationsScreen({ navigation }: AppScreenProps<'Notifications'>) {
  const [tab, setTab] = useState<Tab>('all');
  const list = useNotifications(tab);
  const readAll = useReadAllNotifications();
  const read = useReadNotification();
  const open = useDeepLink();

  const items = list.data?.pages.flatMap((p) => p.data) ?? [];
  const unread = list.data?.pages[0]?.unreadCount ?? 0;

  const onPress = (n: AppNotification) => {
    if (!n.isRead) read.mutate(n.publicId);
    open(n.deepLink);
  };

  return (
    <Screen padded={false} scroll={false}>
      <TopBar
        title="Bildirişlər"
        onBack={navigation.goBack}
        right={
          unread > 0 ? (
            <Text variant="small" color="green900" style={styles.readAll} onPress={() => readAll.mutate()}>
              Hamısını oxu
            </Text>
          ) : null
        }
      />

      <View style={styles.chips}>
        {TABS.map((x) => (
          <Chip key={x.key} label={x.label} active={tab === x.key} onPress={() => setTab(x.key)} />
        ))}
      </View>

      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.publicId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Row n={item} onPress={() => onPress(item)} />}
          ListEmptyComponent={
            <EmptyState
              icon="bell"
              title="Hələ sakitlikdir"
              message="Bəyənmə, şərh, izləmə və yeni nailiyyətlər burada görünəcək."
            />
          }
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={t.colors.green900} />
          }
        />
      )}
    </Screen>
  );
}

function Row({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.row, !n.isRead && styles.rowUnread]}>
      {n.actor ? (
        <Avatar uri={n.actor.avatarUrl} size={44} name={n.actor.fullName} />
      ) : (
        <View style={styles.systemIcon}>
          <Icon name={SYSTEM_ICON[n.type] ?? 'bell'} size={20} color={t.colors.brown700} />
        </View>
      )}
      <View style={styles.flex}>
        <Text variant="small" style={!n.isRead && styles.bold} numberOfLines={2}>
          {n.title}
        </Text>
        <Text variant="caption">{[timeAgo(n.createdAt), n.body].filter(Boolean).join(' · ')}</Text>
      </View>
      {n.imageUrl ? <Photo uri={n.imageUrl} style={styles.thumb} radius={8} /> : null}
      {!n.isRead ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  readAll: { fontWeight: '600' },
  chips: { flexDirection: 'row', gap: t.spacing.sm, paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.md },
  list: { paddingBottom: 40, flexGrow: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: t.spacing.md,
    paddingHorizontal: t.spacing.page, paddingVertical: t.spacing.md,
  },
  rowUnread: { backgroundColor: t.colors.green050 },
  systemIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.brown100,
    alignItems: 'center', justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  bold: { fontWeight: '700' },
  thumb: { width: 44, height: 44, backgroundColor: t.colors.bg2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.green900 },
});
