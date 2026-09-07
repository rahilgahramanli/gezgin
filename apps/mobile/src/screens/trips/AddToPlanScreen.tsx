import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, EmptyState, Icon, Loading, Pill, Screen, Text, TopBar } from '@/components';
import { useAddTripItem } from '@/api/hooks/tripDetail';
import { useTrips } from '@/api/hooks/trips';
import { ApiError } from '@/api/client';
import { TRIP_STATUS_LABEL, label } from '@/lib/labels';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/**
 * Ekran 48 — "Plana əlavə et".
 * Səyahət və gün seçimi; seçim yoxdursa əvvəlcə səyahət yaradılır.
 */
export function AddToPlanScreen({ route, navigation }: AppScreenProps<'AddToPlan'>) {
  const { type, slug, name } = route.params;
  const [tripId, setTripId] = useState<string | undefined>();
  const [day, setDay] = useState(1);

  const trips = useTrips();
  const add = useAddTripItem(tripId ?? '');

  const selected = trips.data?.data.find((tr) => tr.publicId === tripId);
  const error = add.error instanceof ApiError ? add.error.message : null;

  const submit = () => {
    if (!tripId) return;
    add.mutate(
      { type, slug, day },
      { onSuccess: () => navigation.replace('TripDetail', { publicId: tripId }) },
    );
  };

  if (trips.isLoading) return <Loading label="Səyahətlər yüklənir…" />;

  const list = trips.data?.data ?? [];

  return (
    <Screen
      padded={false}
      // Səyahət yoxdursa CTA da yoxdur — istifadəçi əvvəlcə səyahət yaratmalıdır
      footer={
        list.length > 0 ? (
          <Button
            label="Plana əlavə et"
            onPress={submit}
            loading={add.isPending}
            disabled={!tripId}
            style={styles.ctaButton}
          />
        ) : null
      }
    >
      <TopBar title="Plana əlavə et" onBack={navigation.goBack} />

      <View style={styles.body}>
        <Card padded style={styles.target}>
          <Icon name={type === 'experience' ? 'sparkle' : 'pin'} size={20} color={t.colors.green900} />
          <View style={styles.flex}>
            <Text variant="h3" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption">{type === 'experience' ? 'Təcrübə' : 'Məkan'}</Text>
          </View>
        </Card>

        {list.length === 0 ? (
          <EmptyState
            title="Hələ səyahətin yoxdur"
            message="Əvvəlcə səyahət yarat, sonra bura əlavə et."
            action={
              <Button label="Səyahət yarat" onPress={() => navigation.replace('CreateTrip')} />
            }
          />
        ) : (
          <>
            <View>
              <Text variant="h2" style={styles.sectionTitle}>
                Səyahət seç
              </Text>
              {list.map((tr) => {
                const active = tripId === tr.publicId;
                return (
                  <Pressable key={tr.publicId} onPress={() => setTripId(tr.publicId)}>
                    <Card padded style={[styles.option, active && styles.optionActive]}>
                      <View style={[styles.radio, active && styles.radioOn]}>
                        {active ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={styles.flex}>
                        <Text variant="h3" numberOfLines={1}>
                          {tr.title}
                        </Text>
                        <Text variant="caption">
                          {tr.startDate ? tr.startDate.slice(0, 10) : 'Tarixsiz'} · {tr.dayCount} gün
                        </Text>
                      </View>
                      <Pill
                        label={label(TRIP_STATUS_LABEL, tr.status)}
                        tone={tr.status === 'active' ? 'teal' : 'gray'}
                      />
                    </Card>
                  </Pressable>
                );
              })}
            </View>

            {selected ? (
              <View>
                <Text variant="h2" style={styles.sectionTitle}>
                  Gün seç
                </Text>
                <View style={styles.days}>
                  {Array.from({ length: Math.max(1, selected.dayCount) }, (_, i) => i + 1).map((d) => {
                    const active = day === d;
                    return (
                      <Pressable
                        key={d}
                        onPress={() => setDay(d)}
                        style={[styles.day, active && styles.dayActive]}
                      >
                        <Text variant="h3" color={active ? 'paper' : 'ink'}>
                          {d}
                        </Text>
                        <Text variant="caption" color={active ? 'paper' : 'muted'}>
                          gün
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {error ? (
              <Text variant="small" color="danger" center>
                {error}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: t.spacing.xl },
  target: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  sectionTitle: { marginBottom: t.spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.sm },
  optionActive: { borderColor: t.colors.green900, backgroundColor: t.colors.green050 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: t.colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: t.colors.green900 },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: t.colors.green900 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  day: {
    width: 60, alignItems: 'center', paddingVertical: t.spacing.md,
    borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line,
    backgroundColor: t.colors.paper,
  },
  dayActive: { backgroundColor: t.colors.green900, borderColor: t.colors.green900 },
  flex: { flex: 1, minWidth: 0 },
  ctaButton: { width: '100%' },
});
