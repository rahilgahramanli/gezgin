import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Loading, Pill, Screen, Text, TopBar } from '@/components';
import { useCategoryList } from '@/api/hooks/content';
import { useSetInterests } from '@/api/hooks/me';
import { alertError } from '@/lib/errors';
import { t } from '@/theme';
import { useT } from '@/i18n';
import type { AuthScreenProps } from '@/navigation/types';

/** Ekran 04 — maraqların seçimi. Onboarding-in son addımı. */
export function InterestsScreen({ navigation }: AuthScreenProps<'Interests'>) {
  const { t: tr, tp: tpr } = useT('auth');
  const [selected, setSelected] = useState<string[]>([]);
  const categories = useCategoryList();
  const save = useSetInterests();

  const toggle = (slug: string) =>
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  if (categories.isLoading) return <Loading label={tr('interests.loading')} />;

  return (
    <Screen
      padded={false}
      footer={
        <Button
          label={selected.length ? tpr('interests.continue', selected.length) : tr('interests.pickOne')}
          disabled={selected.length === 0}
          loading={save.isPending}
          onPress={() =>
            save.mutate(selected, {
              onSuccess: () => navigation.navigate('ProfileSetup'),
              onError: (error) => alertError(error, tr('interests.saveFailed')),
            })
          }
        />
      }
    >
      <TopBar />
      <View style={styles.body}>
        <Pill label={tr('step', { current: 2, total: 3 })} tone="green" />
        <Text variant="titleXl" style={styles.title}>
          {tr('interests.title')}
        </Text>
        <Text variant="meta">{tr('interests.sub')}</Text>

        <View style={styles.grid}>
          {(categories.data ?? []).map((c) => {
            const active = selected.includes(c.slug);
            return (
              <Pressable
                key={c.slug}
                onPress={() => toggle(c.slug)}
                style={[styles.option, active && styles.optionActive]}
              >
                <View style={[styles.optionIcon, active && styles.optionIconActive]}>
                  <Icon name="sparkle" size={18} color={active ? '#fff' : t.colors.green900} />
                </View>
                <Text variant="body" numberOfLines={1} style={styles.optionLabel}>
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: t.spacing.page, gap: 6 },
  title: { marginTop: t.spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.md,
    marginTop: t.spacing.xl,
  },
  option: {
    width: '47.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: t.spacing.md,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.line,
    backgroundColor: t.colors.paper,
  },
  optionActive: { borderColor: t.colors.green900, backgroundColor: t.colors.green050 },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.green100,
  },
  optionIconActive: { backgroundColor: t.colors.green900 },
  optionLabel: { flex: 1, minWidth: 0 },
});
