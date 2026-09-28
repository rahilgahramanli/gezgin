import { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, Chip, EmptyState, Icon, Photo, Pill, Screen, Skeleton, Text, TopBar } from '@/components';
import { usePlacePhotos } from '@/api/hooks/details';
import { useT } from '@/i18n';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

const GUTTER = 2;
const COLUMNS = 3;
const SIZE = Math.floor((Dimensions.get('window').width - GUTTER * (COLUMNS - 1)) / COLUMNS);

/** Çip mətni render zamanı tərcümə olunur — burada yalnız açarlar. */
const TABS = [
  { key: undefined, labelKey: 'all' },
  { key: 'official' as const, labelKey: 'gallery.official' },
  { key: 'community' as const, labelKey: 'gallery.community' },
];

/** Ekran 46 — məkanın bütün fotoları. Tam ekran baxış üçün toxunuş. */
export function PhotoGalleryScreen({ route, navigation }: AppScreenProps<'PhotoGallery'>) {
  const { t: tr } = useT('explore');
  const { slug, name } = route.params;
  const [filter, setFilter] = useState<'official' | 'community' | undefined>();
  const [zoom, setZoom] = useState<number | null>(null);
  const photos = usePlacePhotos(slug, filter);

  const items = photos.data?.data ?? [];
  const open = zoom === null ? null : items[zoom];

  if (open) {
    return (
      <Screen padded={false} scroll={false} backgroundColor="#000000" edges={['top', 'bottom']}>
        <TopBar light transparent onBack={() => setZoom(null)} title={`${(zoom ?? 0) + 1} / ${items.length}`} />
        <Pressable style={styles.zoomWrap} onPress={() => setZoom(null)}>
          <Photo uri={open.url} style={styles.zoomImage} radius={0} resizeMode="contain" />
        </Pressable>
        {open.uploadedBy ? (
          <View style={styles.zoomFooter}>
            <Avatar uri={open.uploadedBy.avatarUrl} size={32} name={open.uploadedBy.fullName} />
            <Text variant="small" style={styles.zoomAuthor}>
              {open.uploadedBy.fullName}
            </Text>
          </View>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      padded={false}
      footer={
        <Button
          block
          variant="soft"
          label={tr('gallery.addPhoto')}
          left={<Icon name="camera" size={18} color={t.colors.green900} />}
          onPress={() => navigation.navigate('CreatePost', { place: { slug, name } })}
        />
      }
    >
      <TopBar title={name} onBack={navigation.goBack} />

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Chip
            key={tab.labelKey}
            label={
              tab.key && photos.data
                ? `${tr(tab.labelKey)} · ${tab.key === 'official' ? photos.data.counts.official : photos.data.counts.community}`
                : tr(tab.labelKey)
            }
            active={filter === tab.key}
            onPress={() => setFilter(tab.key)}
          />
        ))}
      </View>

      {photos.isLoading ? (
        <View style={styles.grid}>
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} width={SIZE} height={SIZE} radius={0} />
          ))}
        </View>
      ) : !items.length ? (
        <EmptyState
          icon="camera"
          title={tr('gallery.emptyTitle')}
          message={filter === 'community' ? tr('gallery.emptyCommunity') : tr('gallery.emptyOfficial')}
        />
      ) : (
        <View style={styles.grid}>
          {items.map((photo, i) => (
            <Pressable
              key={photo.mediaPublicId}
              onPress={() => setZoom(i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={
                photo.uploadedBy
                  ? tr('gallery.photoBy', { name: photo.uploadedBy.fullName })
                  : tr('gallery.photoN', { n: i + 1 })
              }
            >
              <Photo uri={photo.url} style={styles.cell} radius={0} />
              {!photo.isOfficial ? (
                <Pill label={tr('gallery.communityBadge')} tone="brown" style={styles.badge} />
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: t.spacing.sm, paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GUTTER },
  cell: { width: SIZE, height: SIZE },
  badge: { position: 'absolute', left: 6, bottom: 6 },
  zoomWrap: { flex: 1, justifyContent: 'center' },
  zoomImage: { width: '100%', height: '80%' },
  zoomFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
  },
  zoomAuthor: { color: '#FFFFFF' },
});
