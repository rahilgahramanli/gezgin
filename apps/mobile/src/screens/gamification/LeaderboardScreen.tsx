import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Card, Chip, Loading, Pill, Screen, Text, TopBar } from '@/components';
import { useLeaderboard, type LeaderboardEntry } from '@/api/hooks/gamification';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

const PERIODS = [
  { key: 'weekly', label: 'Həftəlik' },
  { key: 'monthly', label: 'Aylıq' },
  { key: 'all_time', label: 'Bütün zamanlar' },
] as const;

/** Ekran 31 — liderlər cədvəli. */
export function LeaderboardScreen({ navigation }: AppScreenProps<'Leaderboard'>) {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'all_time'>('weekly');
  const board = useLeaderboard(period);

  return (
    <Screen padded={false}>
      <TopBar title="Liderlər" onBack={navigation.goBack} />

      <View style={styles.chips}>
        {PERIODS.map((p) => (
          <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} />
        ))}
      </View>

      {board.isLoading ? (
        <Loading />
      ) : (
        <View style={styles.body}>
          {board.data?.entries.map((e) => (
            <Row key={e.username} entry={e} />
          ))}

          {board.data?.me && !board.data.entries.some((e) => e.isMe) ? (
            <>
              <Text variant="caption" center style={styles.divider}>
                • • •
              </Text>
              <Row entry={board.data.me} />
            </>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const medal = entry.rank <= 3;
  return (
    <Card padded style={[styles.row, entry.isMe && styles.rowMe]}>
      <Text variant="h3" style={[styles.rank, medal && styles.rankMedal]}>
        {entry.rank}
      </Text>
      <Avatar uri={entry.avatarUrl} size={40} name={entry.fullName} />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text variant="h3" numberOfLines={1} style={styles.flex}>
            {entry.fullName}
          </Text>
          {entry.isLocalExpert ? <Pill label="Expert" tone="brown" /> : null}
          {entry.isMe ? <Pill label="Sən" tone="teal" /> : null}
        </View>
        <Text variant="caption">Level {entry.level}</Text>
      </View>
      <View style={styles.points}>
        <Text variant="h3" color="green900">
          {entry.points.toLocaleString('az-AZ')}
        </Text>
        <Text variant="caption">XP</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row', gap: t.spacing.sm,
    paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.lg,
  },
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  rowMe: { borderColor: t.colors.green900, backgroundColor: t.colors.green050 },
  rank: { width: 26, textAlign: 'center', color: t.colors.muted },
  rankMedal: { color: t.colors.star },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  points: { alignItems: 'flex-end' },
  divider: { paddingVertical: 4 },
  flex: { flex: 1, minWidth: 0 },
});
