import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from '@/components';
import { t } from '@/theme';
import { ExploreScreen } from '@/screens/explore/ExploreScreen';
import { TripsScreen } from '@/screens/trips/TripsScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { PlaceholderScreen } from '@/screens/PlaceholderScreen';
import { CreateHubScreen } from '@/screens/CreateHubScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const ICON: Record<keyof TabParamList, IconName> = {
  Discover: 'pin',
  Explore: 'search',
  Create: 'plus',
  Trips: 'map',
  Profile: 'user',
};

/** Ortadakı yaşıl "+" — dizaynda FAB kimi görünür. */
function CreateButton({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.fab, focused && styles.fabActive]}>
      <Icon name="plus" size={26} color="#fff" strokeWidth={2.2} />
    </View>
  );
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      // Discover (sosial lent) Sprint 7-də qurulur — o vaxta qədər tətbiq
      // Explore ilə açılır ki, ilk ekran boş görünməsin.
      initialRouteName="Explore"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.colors.green900,
        tabBarInactiveTintColor: t.colors.muted,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ color, focused }) =>
          route.name === 'Create' ? (
            <CreateButton focused={focused} />
          ) : (
            <Icon name={ICON[route.name]} size={24} color={color} filled={focused} />
          ),
      })}
    >
      <Tab.Screen name="Discover" component={PlaceholderScreen} options={{ title: 'Discover' }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: 'Explore' }} />
      <Tab.Screen
        name="Create"
        component={CreateHubScreen}
        options={{ title: '', tabBarLabel: () => null }}
      />
      <Tab.Screen name="Trips" component={TripsScreen} options={{ title: 'Trips' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: Platform.OS === 'ios' ? 84 : 68,
    paddingTop: 10,
    backgroundColor: t.colors.paper,
    borderTopColor: t.colors.line,
  },
  label: { fontSize: 11, fontWeight: '500' },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: t.colors.green900,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
  },
  fabActive: { backgroundColor: t.colors.green700 },
});
