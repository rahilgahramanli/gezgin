import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, Icon, Loading, Progress, Screen, Text, TopBar } from '@/components';
import { useBadges } from '@/api/hooks/gamification';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 30 — nailiyyətlər və tərəqqi. */
export function BadgesScreen({ navigation }: AppScreenProps<'Badges'>) {
  const badges = useBadges();

  if (badges.isLoading) return <Loading label="Nailiyyətlər yüklənir…" />;
  if (!badges.data) {
    return (
      <Screen padded={false}>
        <TopBar title="Nailiyyətlər" onBack={navigation.goBack} />
        <EmptyState
          title="Məlumat yüklənmədi"
          message={badges.error instanceof Error ? badges.error.message : 'Yenidən cəhd edin.'}
        />
      </Screen>
    );
  }
  const b = badges.data;

  return (
    <Screen padded={false}>
      <TopBar title="Nailiyyətlər" onBack={navigation.goBack} />

      <View style={styles.summary}>
        <Text variant="titleLg" color="green900">
          {b.earnedCount} / {b.totalCount}
        </Text>
        <Text variant="meta">badge qazanılıb</Text>
      </View>

      <View style={styles.body}>
        {/* Qazanılanlar əvvəl, sonra ən yaxın olanlar — kilidlilər sonda */}
        {[...b.badges]
          .sort((x, y) => Number(y.earned) - Number(x.earned) || y.progress / (y.conditionValue || 1) - x.progress / (x.conditionValue || 1))
          .map((badge) => (
          <Card key={badge.slug} padded style={styles.badge}>
            <View style={[styles.icon, badge.earned ? styles.iconEarned : styles.iconLocked]}>
              <Icon
                name={badge.earned ? 'trophy' : 'lock'}
                size={22}
                color={badge.earned ? '#fff' : t.colors.muted}
              />
            </View>

            <View style={styles.flex}>
              <View style={styles.badgeHead}>
                <Text variant="h3" numberOfLines={1} style={styles.flex}>
                  {badge.name}
                </Text>
                <Text variant="caption" color={badge.earned ? 'green900' : 'muted'}>
                  {badge.progress} / {badge.conditionValue}
                </Text>
              </View>
              {badge.description ? (
                <Text variant="caption" numberOfLines={1}>
                  {badge.description}
                </Text>
              ) : null}
              <Progress
                percent={badge.percent}
                tone={badge.earned ? 'teal' : 'green'}
                thin
                style={styles.progress}
              />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', paddingVertical: t.spacing.lg, gap: 2 },
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconEarned: { backgroundColor: t.colors.green900 },
  iconLocked: { backgroundColor: t.colors.bg2 },
  badgeHead: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  progress: { marginTop: 6 },
  flex: { flex: 1, minWidth: 0 },
});
