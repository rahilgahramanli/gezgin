import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Chip, EmptyState, GuestEmpty, Loading, Rating, RowCard, Screen, Text, TopBar,
} from '@/components';
import { useUser } from '@/store/auth';
import { useSaved } from '@/api/hooks/details';
import { SEARCH_TYPE_LABEL, label } from '@/lib/labels';
import { t } from '@/theme';
import { useT } from '@/i18n';
import type { AppScreenProps } from '@/navigation/types';

/** Etiket render zamanı tərcümə olunur — `saved.filters.<countKey>`. */
const FILTERS = [
  { key: undefined, countKey: 'all' },
  { key: 'place', countKey: 'place' },
  { key: 'route', countKey: 'route' },
  { key: 'experience', countKey: 'experience' },
  { key: 'post', countKey: 'post' },
  { key: 'business', countKey: 'business' },
  { key: 'event', countKey: 'event' },
] as const;

/** Həmişə görünən çiplər — qalanları yalnız saxlanmış element varsa göstərilir. */
const ALWAYS = new Set(['all', 'place', 'route', 'experience']);

/** Ekran 33 — İstəklərim (saxlanılanlar). */
export function SavedScreen({ navigation }: AppScreenProps<'Saved'>) {
  const { t: tr } = useT('profile');
  const isGuest = useUser()?.isGuest ?? false;
  const [type, setType] = useState<string | undefined>();
  const saved = useSaved(type);

  const open = (itemType: string, slug: string) => {
    if (itemType === 'place') navigation.navigate('PlaceDetail', { slug });
    else if (itemType === 'route') navigation.navigate('RouteDetail', { slug });
    else if (itemType === 'experience') navigation.navigate('ExperienceDetail', { slug });
    else if (itemType === 'post') navigation.navigate('PostDetail', { publicId: slug });
    else if (itemType === 'business') navigation.navigate('BusinessProfile', { slug });
  };

  return (
    <Screen padded={false}>
      <TopBar title={tr('saved.title')} onBack={navigation.goBack} />

      <View style={styles.chips}>
        {FILTERS.filter((f) => ALWAYS.has(f.countKey) || (saved.data?.counts[f.countKey] ?? 0) > 0 || type === f.key).map((f) => {
          const count = saved.data?.counts[f.countKey] ?? 0;
          const name = tr(`saved.filters.${f.countKey}`);
          return (
            <Chip
              key={f.countKey}
              label={count ? `${name} · ${count}` : name}
              active={type === f.key}
              onPress={() => setType(f.key)}
            />
          );
        })}
      </View>

      <View style={styles.body}>
        {isGuest ? (
          <GuestEmpty
            icon="bookmark"
            title={tr('saved.guestTitle')}
            message={tr('saved.guestMessage')}
          />
        ) : saved.isLoading ? (
          <Loading />
        ) : !saved.data?.data.length ? (
          <EmptyState
            title={tr('saved.emptyTitle')}
            message={tr('saved.emptyMessage')}
          />
        ) : (
          <View style={styles.list}>
            {saved.data.data.map((item) => (
              <RowCard
                key={item.savedId}
                uri={item.imageUrl}
                title={item.title}
                subtitle={item.subtitle}
                meta={
                  <View style={styles.meta}>
                    <Text variant="caption" color="green900" style={styles.tag}>
                      {label(SEARCH_TYPE_LABEL, item.type)}
                    </Text>
                    {item.rating ? <Rating value={item.rating} /> : null}
                    {item.priceAzn ? <Text variant="caption">{item.priceAzn} AZN</Text> : null}
                  </View>
                }
                onPress={() => open(item.type, item.slug)}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm,
    paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.lg,
  },
  body: { paddingHorizontal: t.spacing.page },
  list: { gap: t.spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  tag: {
    backgroundColor: t.colors.green100, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: t.radius.pill, overflow: 'hidden', fontWeight: '600',
  },
});
