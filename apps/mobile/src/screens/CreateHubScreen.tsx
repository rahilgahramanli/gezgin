import { StyleSheet, View } from 'react-native';
import { Card, Icon, Screen, Text } from '@/components';
import { t } from '@/theme';
import type { IconName } from '@/components';
import type { TabScreenProps } from '@/navigation/types';

/**
 * Tab bar-ın ortasındakı FAB.
 *
 * Dizaynda bu düymə birbaşa ekran 26-ya (Paylaş) aparır; burada paylaşımla
 * yanaşı planlama axınları da toplanır — hamısı "yaratmaq" hərəkətidir.
 */
export function CreateHubScreen({ navigation }: TabScreenProps<'Create'>) {
  const actions = [
    {
      icon: 'image' as IconName,
      title: 'Paylaşım et',
      hint: 'Foto və hekayəni bölüş · +300 XP',
      onPress: () => navigation.navigate('CreatePost'),
    },
    {
      icon: 'camera' as IconName,
      title: 'Hekayə',
      hint: '24 saat görünən an',
      onPress: () => navigation.navigate('CreatePost', { mode: 'story' }),
    },
    {
      icon: 'map' as IconName,
      title: 'Yeni səyahət',
      hint: 'Tarix seç, məkanları plana yığ',
      onPress: () => navigation.navigate('CreateTrip'),
    },
    {
      icon: 'route' as IconName,
      title: 'Marşrut qur',
      hint: 'Gün-gün dayanacaqlar · +350 XP',
      onPress: () => navigation.navigate('RouteBuilder'),
    },
    {
      icon: 'pin' as IconName,
      title: 'Check-in et',
      hint: 'Olduğun məkanı qeyd et, XP qazan',
      onPress: () => navigation.navigate('Search'),
    },
  ];

  return (
    <Screen>
      <Text variant="titleLg" style={styles.title}>
        Nə yaradaq?
      </Text>
      <Text variant="small" color="ink2" style={styles.sub}>
        Səyahətini paylaş, planla, kəşf et.
      </Text>

      <View style={styles.list}>
        {actions.map((a) => (
          <Card key={a.title} padded onPress={a.onPress} style={styles.action}>
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
