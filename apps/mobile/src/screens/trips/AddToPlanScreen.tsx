import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, EmptyState, ErrorState, Icon, Loading, Pill, Screen, Text, TopBar } from '@/components';
import { useAddTripItem } from '@/api/hooks/tripDetail';
import { useTrips } from '@/api/hooks/trips';
import { ApiError } from '@/api/client';
import { TRIP_STATUS_LABEL, label } from '@/lib/labels';
import { isGuestBlocked, promptGuestSignup } from '@/lib/errors';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/**
 * Ekran 48 — "Plana əlavə et".
 * Səyahət və gün seçimi; seçim yoxdursa əvvəlcə səyahət yaradılır.
 */
export function AddToPlanScreen({ route, navigation }: AppScreenProps<'AddToPlan'>) {
  const { t: tr, tp: tpr } = useT('trips');
  const { type, slug, name } = route.params;
  const [tripId, setTripId] = useState<string | undefined>();
  const [day, setDay] = useState(1);

  const trips = useTrips();
  const add = useAddTripItem(tripId ?? '');

  const selected = trips.data?.data.find((trip) => trip.publicId === tripId);
  const error = add.error instanceof ApiError ? add.error.message : null;

  const submit = () => {
    if (!tripId) return;
    add.mutate(
      { type, slug, day },
      { onSuccess: () => navigation.replace('TripDetail', { publicId: tripId }) },
    );
  };

  const typeLabel =
    type === 'experience' ? tr('addToPlan.typeExperience') : type === 'event' ? tr('addToPlan.typeEvent') : tr('addToPlan.typePlace');

  if (!trips.data) {
    if (isGuestBlocked(trips.error)) {
      return (
        <Screen padded={false} scroll={false}>
          <TopBar title={tr('addToPlan.title')} onBack={navigation.goBack} />
          <EmptyState
            icon="lock"
            title={tr('common:guest.title')}
            message={tr('addToPlan.guestMessage')}
            action={<Button label={tr('common:actions.signUp')} onPress={() => promptGuestSignup()} />}
          />
        </Screen>
      );
    }
    if (trips.error && !trips.isFetching) {
      return <ErrorState error={trips.error} onRetry={() => void trips.refetch()} onBack={navigation.goBack} />;
    }
    return (
      <Screen padded={false} scroll={false}>
        <TopBar title={tr('addToPlan.title')} onBack={navigation.goBack} />
        <Loading label={tr('shared.loadingTrips')} />
      </Screen>
    );
  }

  // Tamamlanmış və ləğv edilmiş səyahətə yeni element əlavə etməyin mənası yoxdur
  const list = trips.data.data.filter((trip) => trip.status === 'planned' || trip.status === 'active');

  return (
    <Screen
      padded={false}
      // Səyahət yoxdursa CTA da yoxdur — istifadəçi əvvəlcə səyahət yaratmalıdır
      footer={
        list.length > 0 ? (
          <Button
            label={tr('addToPlan.title')}
            onPress={submit}
            loading={add.isPending}
            disabled={!tripId}
            style={styles.ctaButton}
          />
        ) : null
      }
    >
      <TopBar title={tr('addToPlan.title')} onBack={navigation.goBack} />

      <View style={styles.body}>
        <Card padded style={styles.target}>
          <Icon name={type === 'experience' ? 'sparkle' : 'pin'} size={20} color={t.colors.green900} />
          <View style={styles.flex}>
            <Text variant="h3" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption">{typeLabel}</Text>
          </View>
        </Card>

        {list.length === 0 ? (
          <EmptyState
            title={tr('addToPlan.emptyTitle')}
            message={tr('addToPlan.emptyMessage')}
            action={
              <Button label={tr('shared.createTrip')} onPress={() => navigation.replace('CreateTrip')} />
            }
          />
        ) : (
          <>
            <View>
              <Text variant="h2" style={styles.sectionTitle}>
                {tr('addToPlan.pickTrip')}
              </Text>
              {list.map((trip) => {
                const active = tripId === trip.publicId;
                return (
                  <Pressable key={trip.publicId} onPress={() => setTripId(trip.publicId)}>
                    <Card padded style={[styles.option, active && styles.optionActive]}>
                      <View style={[styles.radio, active && styles.radioOn]}>
                        {active ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={styles.flex}>
                        <Text variant="h3" numberOfLines={1}>
                          {trip.title}
                        </Text>
                        <Text variant="caption">
                          {trip.startDate ? trip.startDate.slice(0, 10) : tr('shared.undated')} · {tpr('shared.days', trip.dayCount)}
                        </Text>
                      </View>
                      <Pill
                        label={label(TRIP_STATUS_LABEL, trip.status)}
                        tone={trip.status === 'active' ? 'teal' : 'gray'}
                      />
                    </Card>
                  </Pressable>
                );
              })}
            </View>

            {selected ? (
              <View>
                <Text variant="h2" style={styles.sectionTitle}>
                  {tr('addToPlan.pickDay')}
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
                          {tr('addToPlan.dayUnit')}
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
