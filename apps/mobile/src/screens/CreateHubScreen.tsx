import { StyleSheet, View } from 'react-native';
import { Card, Icon, Screen, Text } from '@/components';
import { t } from '@/theme';
import { useT } from '@/i18n';
import type { IconName } from '@/components';
import type { TabScreenProps } from '@/navigation/types';

/**
 * Tab bar-ın ortasındakı FAB.
 *
 * Dizaynda bu düymə birbaşa ekran 26-ya (Paylaş) aparır; burada paylaşımla
 * yanaşı planlama axınları da toplanır — hamısı "yaratmaq" hərəkətidir.
 */
export function CreateHubScreen({ navigation }: TabScreenProps<'Create'>) {
  const { t: tr } = useT('social');
  const actions = [
    {
      key: 'post',
      icon: 'image' as IconName,
      title: tr('createHub.post.title'),
      hint: tr('createHub.post.hint'),
      onPress: () => navigation.navigate('CreatePost'),
    },
    {
      key: 'story',
      icon: 'camera' as IconName,
      title: tr('shared.story'),
      hint: tr('createHub.story.hint'),
      onPress: () => navigation.navigate('CreatePost', { mode: 'story' }),
    },
    {
      key: 'trip',
      icon: 'map' as IconName,
      title: tr('createHub.trip.title'),
      hint: tr('createHub.trip.hint'),
      onPress: () => navigation.navigate('CreateTrip'),
    },
    {
      key: 'route',
      icon: 'route' as IconName,
      title: tr('createHub.route.title'),
      hint: tr('createHub.route.hint'),
      onPress: () => navigation.navigate('RouteBuilder'),
    },
    {
      key: 'checkin',
      icon: 'pin' as IconName,
      title: tr('createHub.checkin.title'),
      hint: tr('createHub.checkin.hint'),
      // Əvvəl axtarışı açırdı — indi mövqeyə görə yaxın məkanlar siyahısı
      onPress: () => navigation.navigate('CheckinPicker'),
    },
  ];

  return (
    <Screen>
      <Text variant="titleLg" style={styles.title}>
        {tr('createHub.title')}
      </Text>
      <Text variant="small" color="ink2" style={styles.sub}>
        {tr('createHub.subtitle')}
      </Text>

      <View style={styles.list}>
        {actions.map((a) => (
          <Card key={a.key} padded onPress={a.onPress} style={styles.action}>
            <View style={styles.iconBox}>
              <Icon name={a.icon} size={22} color={t.colors.green900} />
            </View>
            <View style={styles.flex}>
              <Text variant="h3">{a.title}</Text>
              <Text variant="caption">{a.hint}</Text>
            </View>
            <Icon name="chevronRight" size={18} color={t.colors.muted} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: t.spacing.lg },
  sub: { marginTop: 4 },
  list: { marginTop: t.spacing.xl, gap: t.spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  iconBox: {
    width: 44, height: 44, borderRadius: t.radius.md, backgroundColor: t.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
});
