import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Loading } from '@/components';
import { useAuth } from '@/store/auth';
import { SplashScreen } from '@/screens/auth/SplashScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { InterestsScreen } from '@/screens/auth/InterestsScreen';
import { TabNavigator } from './TabNavigator';
import { PlaceDetailScreen } from '@/screens/detail/PlaceDetailScreen';
import { RouteDetailScreen } from '@/screens/detail/RouteDetailScreen';
import { ExperienceDetailScreen } from '@/screens/detail/ExperienceDetailScreen';
import { SearchScreen } from '@/screens/list/SearchScreen';
import { PlacesScreen } from '@/screens/list/PlacesScreen';
import { MapScreen } from '@/screens/map/MapScreen';
import { RoutesScreen } from '@/screens/list/RoutesScreen';
import { ExperiencesScreen } from '@/screens/list/ExperiencesScreen';
import { ScoreScreen } from '@/screens/gamification/ScoreScreen';
import { BadgesScreen } from '@/screens/gamification/BadgesScreen';
import { LeaderboardScreen } from '@/screens/gamification/LeaderboardScreen';
import { CheckinScreen } from '@/screens/gamification/CheckinScreen';
import { SavedScreen } from '@/screens/profile/SavedScreen';
import { TripDetailScreen } from '@/screens/trips/TripDetailScreen';
import { BookingScreen } from '@/screens/booking/BookingScreen';
import { BookingSuccessScreen } from '@/screens/booking/BookingSuccessScreen';
import { HotelBookingScreen } from '@/screens/booking/HotelBookingScreen';
import { MyBookingsScreen } from '@/screens/booking/MyBookingsScreen';
import { BusinessProfileScreen } from '@/screens/business/BusinessProfileScreen';
import { CreateTripScreen } from '@/screens/trips/CreateTripScreen';
import { RouteBuilderScreen } from '@/screens/trips/RouteBuilderScreen';
import { RouteAddStopScreen } from '@/screens/trips/RouteAddStopScreen';
import { AddToPlanScreen } from '@/screens/trips/AddToPlanScreen';
import type { AppStackParamList, AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Splash" component={SplashScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function OnboardingFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Interests" component={InterestsScreen} />
    </AuthStack.Navigator>
  );
}

function AppFlow() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Tabs" component={TabNavigator} />
      <AppStack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
      <AppStack.Screen name="RouteDetail" component={RouteDetailScreen} />
      <AppStack.Screen name="ExperienceDetail" component={ExperienceDetailScreen} />
      <AppStack.Screen name="Search" component={SearchScreen} />
      <AppStack.Screen name="Places" component={PlacesScreen} />
      <AppStack.Screen name="Map" component={MapScreen} />
      <AppStack.Screen name="Routes" component={RoutesScreen} />
      <AppStack.Screen name="Experiences" component={ExperiencesScreen} />
      <AppStack.Screen name="Score" component={ScoreScreen} />
      <AppStack.Screen name="Badges" component={BadgesScreen} />
      <AppStack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <AppStack.Screen name="Checkin" component={CheckinScreen} />
      <AppStack.Screen name="Saved" component={SavedScreen} />
      <AppStack.Screen name="TripDetail" component={TripDetailScreen} />
      <AppStack.Screen name="Booking" component={BookingScreen} />
      <AppStack.Screen name="HotelBooking" component={HotelBookingScreen} />
      <AppStack.Screen name="BookingSuccess" component={BookingSuccessScreen} />
      <AppStack.Screen name="MyBookings" component={MyBookingsScreen} />
      <AppStack.Screen name="BusinessProfile" component={BusinessProfileScreen} />
      <AppStack.Screen name="CreateTrip" component={CreateTripScreen} />
      <AppStack.Screen name="RouteBuilder" component={RouteBuilderScreen} />
      <AppStack.Screen name="RouteAddStop" component={RouteAddStopScreen} />
      <AppStack.Screen name="AddToPlan" component={AddToPlanScreen} />
    </AppStack.Navigator>
  );
}

/**
 * Üç vəziyyət: sessiya yoxdur → giriş axını; sessiya var, maraqlar seçilməyib →
 * onboarding; hər ikisi tamamdır → tab bar.
 */
export function RootNavigator() {
  const { session, isRestoring, restore } = useAuth();

  useEffect(() => {
    void restore();
  }, [restore]);

  if (isRestoring) return <Loading />;

  return (
    <NavigationContainer>
      {!session ? <AuthFlow /> : !session.user.onboardingCompleted ? <OnboardingFlow /> : <AppFlow />}
    </NavigationContainer>
  );
}
