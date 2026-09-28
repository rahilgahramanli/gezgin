import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Card, Chip, Loading, Pill, Screen, Text, TopBar } from '@/components';
import { useLeaderboard, type LeaderboardEntry } from '@/api/hooks/gamification';
import { formatNumber } from '@/lib/time';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

// Etiketlər render zamanı `leaderboard.periods.<key>` açarından götürülür — dil dəyişəndə yenilənir
const PERIODS = ['weekly', 'monthly', 'all_time'] as const;
type Period = (typeof PERIODS)[number];
type Unit = 'points' | 'xp';

/** Ekran 31 — liderlər cədvəli. */
export function LeaderboardScreen({ navigation }: AppScreenProps<'Leaderboard'>) {
  const { t: tr } = useT('gamification');
  const [period, setPeriod] = useState<Period>('weekly');
  // "Bütün zamanlar" Gezgin Score üzrədir, həftəlik/aylıq isə həmin dövrdə qazanılan XP
  const unit: Unit = period === 'all_time' ? 'points' : 'xp';
  const board = useLeaderboard(period);

  return (
    <Screen padded={false}>
      <TopBar title={tr('leaderboard.title')} onBack={navigation.goBack} />

      <View style={styles.chips}>
        {PERIODS.map((p) => (
          <Chip key={p} label={tr(`leaderboard.periods.${p}`)} active={period === p} onPress={() => setPeriod(p)} />
        ))}
      </View>

      {board.isLoading ? (
        <Loading />
      ) : (
        <View style={styles.body}>
          {board.data?.entries.map((e) => (
            <Row key={e.username} entry={e} unit={unit} />
          ))}

          {board.data?.me && !board.data.entries.some((e) => e.isMe) ? (
            <>
              <Text variant="caption" center style={styles.divider}>
                • • •
              </Text>
              <Row entry={board.data.me} unit={unit} />
            </>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function Row({ entry, unit }: { entry: LeaderboardEntry; unit: Unit }) {
  const { t: tr, tp: tpr } = useT('gamification');
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
          {entry.isLocalExpert ? <Pill label={tr('leaderboard.expert')} tone="brown" /> : null}
          {entry.isMe ? <Pill label={tr('leaderboard.you')} tone="teal" /> : null}
        </View>
        <Text variant="caption">{tr('shared.level', { level: entry.level })}</Text>
      </View>
      <View style={styles.points}>
        <Text variant="h3" color="green900">
          {formatNumber(entry.points)}
        </Text>
        <Text variant="caption">
          {unit === 'points' ? tpr('leaderboard.points', entry.points) : tr('leaderboard.xp')}
        </Text>
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
