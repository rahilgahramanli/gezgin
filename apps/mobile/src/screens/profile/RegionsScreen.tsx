import { StyleSheet, View } from 'react-native';
import { Card, Icon, ListSkeleton, Photo, Progress, Screen, Text, TopBar } from '@/components';
import { useRegionProgress } from '@/api/hooks/me';
import { t } from '@/theme';
import { useT } from '@/i18n';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 32 — regionların kəşfi: neçəsi açılıb, hansı qalıb. */
export function RegionsScreen({ navigation }: AppScreenProps<'Regions'>) {
  const { t: tr, tp: tpr } = useT('profile');
  const progress = useRegionProgress();
  const p = progress.data;
  const left = p ? p.total - p.discovered : 0;

  return (
    <Screen padded={false}>
      <TopBar title={tr('regions.title')} onBack={navigation.goBack} />

      <Card padded style={styles.head}>
        <View style={styles.headRow}>
          <Text variant="titleLg">
            {tpr('regions.progress', p?.total ?? 0, { replace: { discovered: p?.discovered ?? 0 } })}
          </Text>
          <Text variant="h2" color="green700">
            {p?.percent ?? 0}%
          </Text>
        </View>
        <Progress percent={p?.percent ?? 0} />
        <Text variant="meta" color="muted">
          {left > 0 ? tpr('regions.left', left) : tr('regions.allDone')}
        </Text>
      </Card>

      {progress.isLoading ? (
        <ListSkeleton rows={5} />
      ) : (
        <View style={styles.list}>
          {(p?.regions ?? []).map((r) => (
            <Card
              key={r.slug}
              style={styles.row}
              onPress={() => navigation.navigate('Places', { region: r.slug })}
              accessibilityLabel={`${r.name}, ${tpr('regions.placesProgress', r.placeCount, { replace: { visited: r.visitedPlaces } })}`}
            >
              <Photo uri={r.coverUrl} style={[styles.thumb, !r.discovered && styles.dim]} />
              <View style={styles.rowBody}>
                <Text variant="body" style={styles.rowName}>
                  {r.name}
                </Text>
                <Text variant="meta" color="muted">
                  {r.discovered
                    ? tpr('regions.placesProgress', r.placeCount, { replace: { visited: r.visitedPlaces } })
                    : tpr('regions.placesWaiting', r.placeCount)}
                </Text>
                {/* Kəşf edilməmiş regionda boş çubuq və "0%" eyni şeyi iki dəfə deyirdi */}
                {r.discovered ? <Progress percent={r.percent} thin /> : null}
              </View>
              {r.discovered ? (
                <Text variant="small" color="green700">
                  {r.percent}%
                </Text>
              ) : (
                <Icon name="compass" size={18} color={t.colors.muted} />
              )}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { margin: t.spacing.page, marginTop: 0, gap: t.spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  list: { paddingHorizontal: t.spacing.page, gap: t.spacing.md, paddingBottom: t.spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, padding: t.spacing.md },
  thumb: { width: 64, height: 64 },
  /** Kəşf edilməmiş region solğun görünür — irəliləyiş hissi yaranır. */
  dim: { opacity: 0.35 },
  rowBody: { flex: 1, gap: 4 },
  rowName: { fontWeight: '600' },
});
