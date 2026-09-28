import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, Icon, Loading, Progress, Screen, Text, TopBar } from '@/components';
import { useScore } from '@/api/hooks/gamification';
import { formatNumber } from '@/lib/time';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 29 — Gezgin Score və xal qazanma yolları. */
export function ScoreScreen({ navigation }: AppScreenProps<'Score'>) {
  const { t: tr, tp: tpr } = useT('gamification');
  const score = useScore();

  if (score.isLoading) return <Loading label={tr('score.loading')} />;
  if (!score.data) {
    return (
      <Screen padded={false}>
        <TopBar title={tr('shared.gezginScore')} onBack={navigation.goBack} />
        <EmptyState
          title={tr('shared.loadFailed')}
          message={score.error instanceof Error ? score.error.message : tr('shared.tryAgain')}
        />
      </Screen>
    );
  }
  const s = score.data;

  return (
    <Screen padded={false}>
      <TopBar title={tr('shared.gezginScore')} onBack={navigation.goBack} />

      <View style={styles.hero}>
        <Text variant="titleXl" color="green900" style={styles.score}>
          {formatNumber(s.gezginScore)}
        </Text>
        <Text variant="meta">{tr('shared.gezginScore')}</Text>
        {s.trendPercent != null ? (
          <View style={styles.trend}>
            <Icon name="arrowRight" size={14} color={t.colors.teal400} />
            <Text variant="small" color="teal400" style={styles.bold}>
              {tr('score.trend', { trend: `${s.trendPercent > 0 ? '+' : ''}${s.trendPercent}` })}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Card padded style={styles.levelCard}>
          <View style={styles.levelHead}>
            <View>
              <Text variant="h2">{tr('shared.level', { level: s.level })}</Text>
              <Text variant="meta">{s.tier}</Text>
            </View>
            <View style={styles.levelRight}>
              <Text variant="h2" color="green900">
                {s.xpToNext}
              </Text>
              <Text variant="caption">{tr('score.toNextLevel')}</Text>
            </View>
          </View>
          <Progress percent={s.percent} />
          <View style={styles.xpRow}>
            <Text variant="small" color="muted">
              {tr('score.xpProgress', { current: s.xpInLevel, total: s.xpForLevel })}
            </Text>
            <Text variant="small" color="muted">
              {tr('score.last30', { xp: s.last30Days.xp })}
            </Text>
          </View>
        </Card>

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            {tr('score.earnTitle')}
          </Text>
          <View style={styles.rules}>
            {s.earnRules.map((rule) => (
              <View key={rule.action} style={styles.rule}>
                <View style={styles.ruleIcon}>
                  <Icon name="sparkle" size={17} color={t.colors.green900} />
                </View>
                <View style={styles.flex}>
                  <Text variant="body">{rule.name}</Text>
                  {rule.dailyCap ? (
                    <Text variant="caption">{tpr('score.dailyCap', rule.dailyCap)}</Text>
                  ) : null}
                </View>
                <Text variant="h3" color="green900">
                  +{rule.xp}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: t.spacing.xl, gap: 2 },
  score: { fontSize: 44, lineHeight: 50 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  bold: { fontWeight: '700' },
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.xl },
  levelCard: { gap: t.spacing.md },
  levelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  levelRight: { alignItems: 'flex-end' },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { marginBottom: t.spacing.md },
  rules: { gap: t.spacing.md },
  rule: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  ruleIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: t.colors.green100, alignItems: 'center', justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
});
