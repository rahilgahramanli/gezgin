import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button, Card, Icon, Loading, Photo, Pill, Rating, Screen, SectionHead, Text, TopBar,
} from '@/components';
import { useBusiness } from '@/api/hooks/business';
import { AMENITY_LABEL, BUSINESS_TYPE_LABEL, label } from '@/lib/labels';
import { shareItem } from '@/lib/share';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

/** Ekran 22 — biznes profili və paketlər. */
export function BusinessProfileScreen({ route, navigation }: AppScreenProps<'BusinessProfile'>) {
  const { slug } = route.params;
  const business = useBusiness(slug);

  if (business.isLoading) return <Loading label="Yüklənir…" />;
  if (!business.data) return null;
  const b = business.data;

  return (
    <Screen padded={false} edges={[]}>
      <View style={styles.cover}>
        <Photo uri={b.coverUrl} style={styles.coverImage} radius={0} />
        <View style={styles.coverShade} />
        <View style={styles.coverBar}>
          <TopBar
            light
            transparent
            onBack={navigation.goBack}
            actions={[{ icon: 'share', label: 'Paylaş', onPress: () => void shareItem('business', slug, b.name) }]}
          />
        </View>
        {b.photoCount > 0 ? (
          <View style={styles.photoBadge}>
            <Icon name="camera" size={13} color="#fff" />
            <Text variant="caption" style={styles.photoBadgeText}>
              {b.photoCount} foto
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.head}>
        {b.logoUrl ? (
          <Photo uri={b.logoUrl} style={styles.logo} radius={32} />
        ) : (
          <View style={styles.logoFallback}>
            <Icon name="landmark" size={26} color="#fff" />
          </View>
        )}

        <Text variant="titleLg" style={styles.name}>
          {b.name}
        </Text>
        <View style={styles.metaRow}>
          <Text variant="meta">
            {label(BUSINESS_TYPE_LABEL, b.type)} · {b.region.name}
          </Text>
          {b.isVerified ? <Pill label="Təsdiqlənib" tone="teal" /> : null}
        </View>
        {b.ratingCount > 0 ? <Rating value={b.rating} count={b.ratingCount} size={18} /> : null}
      </View>

      <View style={styles.body}>
        {b.description ? (
          <Text variant="body" color="ink2" style={styles.description}>
            {b.description}
          </Text>
        ) : null}

        {b.services.length ? (
          <View>
            <SectionHead title="Xidmətlər" />
            <View style={styles.services}>
              {b.services.map((s) => (
                <Pill key={s} label={label(AMENITY_LABEL, s)} tone="gray" />
              ))}
            </View>
          </View>
        ) : null}

        {b.photos.length > 1 ? (
          <View>
            <SectionHead title="Fotolar" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
              {b.photos.map((p, i) => (
                <Photo key={i} uri={p.url} style={styles.galleryPhoto} radius={t.radius.md} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {b.packages.length ? (
          <View>
            <SectionHead title="Təkliflər və paketlər" />
            <View style={styles.packages}>
              {b.packages.map((p) => (
                <Card key={p.publicId} padded style={styles.package}>
                  <Text variant="h3">{p.title}</Text>
                  <Text variant="meta">
                    {p.nights} gecə / {p.days} gün
                  </Text>
                  {p.description ? (
                    <Text variant="small" color="ink2" numberOfLines={2}>
                      {p.description}
                    </Text>
                  ) : null}
                  {p.includes.length ? (
                    <View style={styles.includes}>
                      {p.includes.map((i) => (
                        <Pill key={i} label={label(AMENITY_LABEL, i)} tone="green" />
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.packageFooter}>
                    <View>
                      <Text variant="h2" color="green900">
                        {p.priceAzn} AZN
                      </Text>
                      {p.pricePerNightAzn ? (
                        <Text variant="caption">gecəsi {p.pricePerNightAzn} AZN</Text>
                      ) : null}
                    </View>
                    <Button
                      label="Rezervasiya"
                      size="sm"
                      onPress={() =>
                        navigation.navigate('HotelBooking', { business: slug, package: p.publicId })
                      }
                    />
                  </View>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.contact}>
          {b.phone ? (
            <Button
              label="Zəng et"
              variant="outline"
              left={<Icon name="chat" size={17} color={t.colors.green900} />}
              onPress={() => Linking.openURL(`tel:${b.phone}`)}
              style={styles.contactBtn}
            />
          ) : null}
          {b.website ? (
            <Button
              label="Vebsayt"
              variant="soft"
              left={<Icon name="globe" size={17} color={t.colors.green900} />}
              onPress={() => Linking.openURL(`https://${b.website?.replace(/^https?:\/\//, '')}`)}
              style={styles.contactBtn}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 220, backgroundColor: t.colors.bg2 },
  coverImage: { width: '100%', height: 220 },
  coverShade: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,20,20,0.28)',
  },
  coverBar: { position: 'absolute', top: 44, left: 0, right: 0 },
  photoBadge: {
    position: 'absolute', right: t.spacing.page, bottom: t.spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: t.radius.pill,
  },
  photoBadgeText: { color: '#fff' },
  head: { alignItems: 'center', marginTop: -32, gap: 4, paddingHorizontal: t.spacing.page },
  logo: { width: 64, height: 64, borderWidth: 3, borderColor: t.colors.paper },
  logoFallback: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.green900,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: t.colors.paper,
  },
  name: { marginTop: t.spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  body: { paddingHorizontal: t.spacing.page, marginTop: t.spacing.lg, gap: t.spacing.xl },
  description: { lineHeight: 23 },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  hscroll: { gap: t.spacing.md, paddingRight: t.spacing.page },
  galleryPhoto: { width: 160, height: 110, backgroundColor: t.colors.bg2 },
  packages: { gap: t.spacing.md },
  package: { gap: 6 },
  includes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  packageFooter: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: t.spacing.sm,
  },
  contact: { flexDirection: 'row', gap: t.spacing.md },
  contactBtn: { flex: 1 },
});
