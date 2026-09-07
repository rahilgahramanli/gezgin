import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button, Card, Icon, Input, Loading, Photo, Screen, Text, TopBar,
} from '@/components';
import { useRegions } from '@/api/hooks/content';
import { useRouteDetail } from '@/api/hooks/details';
import {
  useAddStop, useCreateRoute, useRemoveStop, useReorderStops, useUpdateRoute,
} from '@/api/hooks/routeBuilder';
import { ApiError } from '@/api/client';
import { DIFFICULTY_LABEL, label } from '@/lib/labels';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

const DIFFICULTIES = ['asan', 'orta', 'cetin'] as const;

/**
 * Ekran 50 — marşrut qurucu.
 *
 * İki mərhələ: `slug` yoxdursa əvvəlcə marşrut yaradılır (ad, region, gün),
 * sonra eyni ekran dayanacaq redaktoruna çevrilir. Beləliklə istifadəçi
 * "Yarat" düyməsindən sonra ayrıca ekrana keçmir.
 */
export function RouteBuilderScreen({ route, navigation }: AppScreenProps<'RouteBuilder'>) {
  const slug = route.params?.slug;
  return slug ? (
    <RouteEditor slug={slug} navigation={navigation} />
  ) : (
    <RouteCreator navigation={navigation} />
  );
}

type Nav = AppScreenProps<'RouteBuilder'>['navigation'];

/** 1-ci mərhələ — boş marşrutun əsas məlumatları. */
function RouteCreator({ navigation }: { navigation: Nav }) {
  const [title, setTitle] = useState('');
  const [region, setRegion] = useState<string | undefined>();
  const [days, setDays] = useState(2);
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('asan');

  const regions = useRegions();
  const create = useCreateRoute();
  const error = create.error instanceof ApiError ? create.error.message : null;

  const submit = () => {
    if (!region) return;
    create.mutate(
      { title: title.trim(), region, days, difficulty },
      // `replace` — geri düyməsi boş formaya qayıtmasın
      { onSuccess: (r) => navigation.replace('RouteBuilder', { slug: r.slug }) },
    );
  };

  return (
    <Screen
      padded={false}
      footer={
        <Button
          label="Marşrutu yarat · +350 XP"
          onPress={submit}
          loading={create.isPending}
          disabled={title.trim().length < 3 || !region}
          style={styles.ctaButton}
        />
      }
    >
      <TopBar title="Marşrut qur" onBack={navigation.goBack} />

      <View style={styles.body}>
        <Input
          label="Marşrutun adı"
          icon="route"
          placeholder="Quba həftəsonu marşrutu"
          value={title}
          onChangeText={setTitle}
          error={error}
        />

        <View>
          <Text variant="small" color="ink2" style={styles.label}>
            Region
          </Text>
          {regions.isLoading ? (
            <Loading />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
              {(regions.data ?? []).map((r) => {
                const active = region === r.slug;
                return (
                  <Pressable
                    key={r.slug}
                    onPress={() => setRegion(r.slug)}
                    style={[styles.regionChip, active && styles.regionChipActive]}
                  >
                    <Text variant="small" color={active ? 'paper' : 'ink'}>
                      {r.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text variant="body">Neçə gün?</Text>
            <Text variant="caption">Sonradan dəyişə bilərsən</Text>
          </View>
          <View style={styles.stepperControls}>
            <Pressable
              onPress={() => setDays((v) => Math.max(1, v - 1))}
              style={[styles.stepBtn, days <= 1 && styles.stepBtnOff]}
              disabled={days <= 1}
            >
              <Icon name="minus" size={14} color={days <= 1 ? t.colors.muted : t.colors.green900} strokeWidth={2.4} />
            </Pressable>
            <Text variant="h3" style={styles.stepValue}>
              {days}
            </Text>
            <Pressable onPress={() => setDays((v) => Math.min(30, v + 1))} style={styles.stepBtn}>
              <Icon name="plus" size={14} color={t.colors.green900} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        <View>
          <Text variant="small" color="ink2" style={styles.label}>
            Çətinlik
          </Text>
          <View style={styles.segment}>
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDifficulty(d)}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                >
                  <Text variant="small" color={active ? 'paper' : 'ink'}>
                    {label(DIFFICULTY_LABEL, d)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Screen>
  );
}

/** 2-ci mərhələ — gün-gün dayanacaqlar. */
function RouteEditor({ slug, navigation }: { slug: string; navigation: Nav }) {
  const [day, setDay] = useState(1);

  const detail = useRouteDetail(slug);
  const update = useUpdateRoute(slug);
  const removeStop = useRemoveStop(slug);
  const reorder = useReorderStops(slug);

  const r = detail.data;
  const stops = useMemo(() => r?.itinerary.find((d) => d.day === day)?.stops ?? [], [r, day]);
  const isPublic = r?.visibility === 'public';

  /** Yuxarı/aşağı — yalnız cari günün sırası göndərilir. */
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    const ids = stops.map((s) => s.stopId);
    const moved = ids.splice(index, 1)[0];
    if (moved === undefined) return;
    ids.splice(target, 0, moved);
    reorder.mutate(ids.map((stopId, i) => ({ stopId, day, order: i })));
  };

  const confirmRemove = (stopId: number, name: string) =>
    Alert.alert('Dayanacağı sil', `“${name}” marşrutdan çıxarılsın?`, [
      { text: 'İmtina', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => removeStop.mutate(stopId) },
    ]);

  if (detail.isLoading) return <Loading label="Yüklənir…" />;
  if (!r) return null;

  return (
    <Screen
      padded={false}
      footer={
        <Button
          label="Saxla və bax"
          onPress={() => navigation.replace('RouteDetail', { slug })}
          loading={update.isPending || reorder.isPending || removeStop.isPending}
          style={styles.ctaButton}
        />
      }
    >
      <TopBar title="Marşrut qur" onBack={navigation.goBack} />

      <View style={styles.body}>
        <Text variant="titleLg">{r.title}</Text>

        <Card padded style={styles.stats}>
          <Stat value={r.distanceKm === null ? '—' : `${Math.round(r.distanceKm)} km`} name="Məsafə" />
          <View style={styles.statDivider} />
          <Stat value={`${r.days} gün`} name="Müddət" />
          <View style={styles.statDivider} />
          <Stat value={String(r.stopCount)} name="Məkan" />
        </Card>

        {/* Gün seçici + yeni gün */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
          {r.itinerary.map((d) => {
            const active = d.day === day;
            return (
              <Pressable
                key={d.day}
                onPress={() => setDay(d.day)}
                style={[styles.dayTab, active && styles.dayTabActive]}
              >
                <Text variant="small" color={active ? 'paper' : 'ink'}>
                  {d.day}-ci gün
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => update.mutate({ days: r.days + 1 }, { onSuccess: () => setDay(r.days + 1) })}
            style={[styles.dayTab, styles.dayTabAdd]}
          >
            <Icon name="plus" size={13} color={t.colors.green900} strokeWidth={2.6} />
            <Text variant="small" color="green900">
              Gün
            </Text>
          </Pressable>
        </ScrollView>

        <View>
          {stops.length === 0 ? (
            <Card padded style={styles.notice}>
              <Icon name="pin" size={20} color={t.colors.muted} />
              <Text variant="small" color="ink2" style={styles.flex}>
                {day}-ci gün hələ boşdur — aşağıdan məkan əlavə et.
              </Text>
            </Card>
          ) : (
            stops.map((s, i) => (
              <View key={s.stopId}>
                <Card padded style={styles.stop}>
                  <View style={styles.stopNum}>
                    <Text variant="caption" color="paper">
                      {i + 1}
                    </Text>
                  </View>
                  <Photo uri={s.place.coverUrl} style={styles.stopThumb} radius={10} />
                  <View style={styles.flex}>
                    <Text variant="h3" numberOfLines={1}>
                      {s.place.name}
                    </Text>
                    <Text variant="caption" numberOfLines={1}>
                      {[s.arriveTime, s.durationMin ? `${Math.round(s.durationMin / 60 * 10) / 10} saat` : null]
                        .filter(Boolean)
                        .join(' · ') || 'Vaxt təyin edilməyib'}
                    </Text>
                  </View>
                  <View style={styles.stopActions}>
                    <Pressable onPress={() => move(i, -1)} disabled={i === 0} style={styles.iconBtn}>
                      <Icon
                        name="chevronDown"
                        size={16}
                        color={i === 0 ? t.colors.line : t.colors.muted}
                        style={styles.flip}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => move(i, 1)}
                      disabled={i === stops.length - 1}
                      style={styles.iconBtn}
                    >
                      <Icon
                        name="chevronDown"
                        size={16}
                        color={i === stops.length - 1 ? t.colors.line : t.colors.muted}
                      />
                    </Pressable>
                    <Pressable onPress={() => confirmRemove(s.stopId, s.place.name)} style={styles.iconBtn}>
                      <Icon name="trash" size={16} color={t.colors.danger} />
                    </Pressable>
                  </View>
                </Card>
                {i < stops.length - 1 ? (
                  <View style={styles.leg}>
                    <Icon name="navigation" size={11} color={t.colors.muted} />
                    <Text variant="caption">növbəti dayanacaq</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}

          <Pressable onPress={() => navigation.navigate('RouteAddStop', { slug, day })}>
            <Card padded style={styles.addStop}>
              <Icon name="plus" size={18} color={t.colors.green900} strokeWidth={2.6} />
              <View style={styles.flex}>
                <Text variant="h3" color="green900">
                  Məkan əlavə et
                </Text>
                <Text variant="caption">Axtar və {day}-ci günə əlavə et</Text>
              </View>
            </Card>
          </Pressable>
        </View>

        <Pressable onPress={() => update.mutate({ isPublic: !isPublic })}>
          <Card padded style={styles.toggleRow}>
            <View style={styles.flex}>
              <Text variant="h3">İctimai paylaş</Text>
              <Text variant="caption">Başqaları görə bilsin</Text>
            </View>
            <View style={[styles.switch, isPublic && styles.switchOn]}>
              <View style={[styles.knob, isPublic && styles.knobOn]} />
            </View>
          </Card>
        </Pressable>
      </View>
    </Screen>
  );
}

function Stat({ value, name }: { value: string; name: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="h3">{value}</Text>
      <Text variant="caption">{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.xl },
  label: { fontWeight: '600', marginBottom: t.spacing.sm },
  hscroll: { gap: t.spacing.sm, paddingRight: t.spacing.page },
  regionChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: t.radius.pill,
    borderWidth: 1, borderColor: t.colors.line, backgroundColor: t.colors.paper,
  },
  regionChipActive: { backgroundColor: t.colors.green900, borderColor: t.colors.green900 },
  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnOff: { backgroundColor: t.colors.bg2 },
  stepValue: { minWidth: 20, textAlign: 'center' },
  segment: { flexDirection: 'row', gap: t.spacing.sm },
  segmentItem: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: t.radius.md,
    borderWidth: 1, borderColor: t.colors.line, backgroundColor: t.colors.paper,
  },
  segmentItemActive: { backgroundColor: t.colors.green900, borderColor: t.colors.green900 },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: t.colors.line },
  dayTab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: t.radius.pill,
    borderWidth: 1, borderColor: t.colors.line, backgroundColor: t.colors.paper,
  },
  dayTabActive: { backgroundColor: t.colors.green900, borderColor: t.colors.green900 },
  dayTabAdd: { borderStyle: 'dashed', borderColor: t.colors.green900 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.sm },
  stop: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  stopNum: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center',
  },
  stopThumb: { width: 44, height: 44, backgroundColor: t.colors.bg2 },
  stopActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  /** `chevronDown`-u çevirib "yuxarı" oxu alırıq — ayrıca ikon lazım deyil. */
  flip: { transform: [{ rotate: '180deg' }] },
  leg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  addStop: {
    flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginTop: t.spacing.sm,
    borderStyle: 'dashed', borderColor: t.colors.green900, backgroundColor: t.colors.green050,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  switch: {
    width: 46, height: 28, borderRadius: 14, backgroundColor: t.colors.bg2,
    padding: 3, justifyContent: 'center',
  },
  switchOn: { backgroundColor: t.colors.green900 },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.paper },
  knobOn: { alignSelf: 'flex-end' },
  flex: { flex: 1, minWidth: 0 },
  ctaButton: { width: '100%' },
});
