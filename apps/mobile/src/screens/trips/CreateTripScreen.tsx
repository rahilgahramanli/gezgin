import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Input, Loading, Photo, Screen, Text, TopBar } from '@/components';
import { useCreateTrip } from '@/api/hooks/tripDetail';
import { useRoutes } from '@/api/hooks/content';
import { ApiError } from '@/api/client';
import { addLocalDays, localIsoDate } from '@/lib/date';
import { monthShort } from '@/lib/time';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';


/** Ekran 24 — yeni səyahət: sıfırdan və ya hazır marşrutdan. */
export function CreateTripScreen({ route, navigation }: AppScreenProps<'CreateTrip'>) {
  const { t: tr, tp: tpr } = useT('trips');
  const [title, setTitle] = useState(route.params?.title ?? '');
  const [travelers, setTravelers] = useState(2);
  const [fromRoute, setFromRoute] = useState<string | undefined>(route.params?.fromRoute);
  const [startsIn, setStartsIn] = useState(7);

  const routes = useRoutes({ sort: 'popular', limit: 6 });
  const create = useCreateTrip();

  // Çipdə göstərilən YERLİ gün göndərilir — `toISOString()` UTC-dir və Bakıda
  // 00:00–04:00 arası "5 okt" seçimi 4 oktyabr kimi gedirdi
  const startDate = addLocalDays(startsIn);
  const error = create.error instanceof ApiError ? create.error.message : null;

  const submit = () =>
    create.mutate(
      {
        title: title.trim(),
        travelers,
        startDate: localIsoDate(startDate),
        ...(fromRoute ? { fromRoute } : {}),
      },
      { onSuccess: (trip) => navigation.replace('TripDetail', { publicId: trip.publicId }) },
    );

  return (
    <Screen
      padded={false}
      footer={
        <Button
          label={tr('create.submit')}
          onPress={submit}
          loading={create.isPending}
          disabled={title.trim().length < 2}
          style={styles.ctaButton}
        />
      }
    >
      <TopBar title={tr('create.title')} onBack={navigation.goBack} />

      <View style={styles.body}>
        <Input
          label={tr('create.nameLabel')}
          icon="edit"
          placeholder={tr('create.namePlaceholder')}
          value={title}
          onChangeText={setTitle}
          error={error}
        />

        <View>
          <Text variant="small" color="ink2" style={styles.label}>
            {tr('create.startDate')}
          </Text>
          <View style={styles.dateRow}>
            {[0, 7, 14, 30].map((days) => {
              const d = addLocalDays(days);
              const active = startsIn === days;
              return (
                <Pressable
                  key={days}
                  onPress={() => setStartsIn(days)}
                  style={[styles.date, active && styles.dateActive]}
                >
                  <Text variant="h3" color={active ? 'paper' : 'ink'}>
                    {d.getDate()}
                  </Text>
                  <Text variant="caption" color={active ? 'paper' : 'muted'}>
                    {monthShort(d.getMonth())}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.travelers}>
          <View style={styles.flex}>
            <Text variant="body">{tr('create.travelers')}</Text>
            <Text variant="caption">{tr('create.travelersHint')}</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setTravelers((v) => Math.max(1, v - 1))}
              style={styles.stepBtn}
              disabled={travelers <= 1}
            >
              <Icon
                name="minus"
                size={14}
                color={travelers <= 1 ? t.colors.muted : t.colors.green900}
                strokeWidth={2.4}
              />
            </Pressable>
            <Text variant="h3" style={styles.stepValue}>
              {travelers}
            </Text>
            <Pressable onPress={() => setTravelers((v) => Math.min(20, v + 1))} style={styles.stepBtn}>
              <Icon name="plus" size={14} color={t.colors.green900} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        <View>
          <Text variant="h2" style={styles.sectionTitle}>
            {tr('create.howToStart')}
          </Text>

          <Pressable onPress={() => setFromRoute(undefined)}>
            <Card padded style={[styles.option, !fromRoute && styles.optionActive]}>
              <View style={[styles.radio, !fromRoute && styles.radioOn]}>
                {!fromRoute ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.flex}>
                <Text variant="h3">{tr('create.fromScratch')}</Text>
                <Text variant="caption">{tr('create.fromScratchHint')}</Text>
              </View>
            </Card>
          </Pressable>

          {routes.isLoading ? (
            <Loading />
          ) : (
            (routes.data?.data ?? []).map((r) => {
              const active = fromRoute === r.slug;
              return (
                <Pressable key={r.slug} onPress={() => setFromRoute(r.slug)}>
                  <Card padded style={[styles.option, active && styles.optionActive]}>
                    <View style={[styles.radio, active && styles.radioOn]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Photo uri={r.coverUrl} style={styles.routeThumb} radius={10} />
                    <View style={styles.flex}>
                      <Text variant="h3" numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text variant="caption">
                        {tpr('shared.days', r.days)} · {tpr('create.stops', r.stopCount)} · {r.region.name}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.xl },
  label: { fontWeight: '600', marginBottom: t.spacing.sm },
  dateRow: { flexDirection: 'row', gap: t.spacing.sm },
  date: {
    flex: 1, alignItems: 'center', paddingVertical: t.spacing.md,
    borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line,
    backgroundColor: t.colors.paper,
  },
  dateActive: { backgroundColor: t.colors.green900, borderColor: t.colors.green900 },
  travelers: { flexDirection: 'row', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValue: { minWidth: 20, textAlign: 'center' },
  sectionTitle: { marginBottom: t.spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.sm },
  optionActive: { borderColor: t.colors.green900, backgroundColor: t.colors.green050 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: t.colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: t.colors.green900 },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: t.colors.green900 },
  routeThumb: { width: 44, height: 44, backgroundColor: t.colors.bg2 },
  flex: { flex: 1, minWidth: 0 },
  ctaButton: { width: '100%' },
});
