import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

/** Giriş axını — ekran 01–04, 37–39. */
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Interests: undefined;
  ProfileSetup: undefined;
};

/** Tab bar — ekran 05–56-da olan 5 element. */
export type TabParamList = {
  Discover: undefined;
  Explore: undefined;
  Create: undefined;
  Trips: undefined;
  Profile: undefined;
};

/** Tabların üstündəki detal ekranları. */
export type AppStackParamList = {
  Tabs: undefined;
  PlaceDetail: { slug: string };
  RouteDetail: { slug: string };
  ExperienceDetail: { slug: string };
  Search: undefined;
  Places: { region?: string; filter?: import('@/screens/list/FilterSheetScreen').PlaceFilterValue } | undefined;
  Map: { region?: string } | undefined;
  Routes: undefined;
  Experiences: undefined;
  Saved: undefined;
  TripDetail: { publicId: string };
  Booking: { experience: string };
  HotelBooking: { business: string; package?: string };
  BookingSuccess: { publicId: string };
  MyBookings: undefined;
  /** Rezervasiya detalı: status, ləğv siyasəti, bilet, "Ödənişi tamamla". */
  BookingDetail: { publicId: string };
  /** "Ödəniş üsullarım" — Tənzimləmələr → Hesab. */
  PaymentMethods: undefined;
  BusinessProfile: { slug: string };
  /** Marşrut detalından gələndə həmin marşrut əvvəlcədən seçilir. */
  CreateTrip: { fromRoute?: string; title?: string } | undefined;
  /** `slug` verilməsə əvvəlcə marşrut yaradılır — ekran 50. */
  RouteBuilder: { slug?: string } | undefined;
  RouteAddStop: { slug: string; day: number };
  AddToPlan: { type: 'place' | 'experience' | 'event'; slug: string; name: string };
  Score: undefined;
  Badges: undefined;
  Leaderboard: undefined;
  Checkin: { place: string; trip?: string };
  // Sprint 7 — sosial
  PostDetail: { publicId: string; focusComment?: boolean };
  Notifications: undefined;
  Messages: undefined;
  Chat: { publicId: string };
  /** `story` rejimi bir foto + başlıq ilə hekayə paylaşır. */
  CreatePost: { mode?: 'post' | 'story'; place?: { slug: string; name: string } } | undefined;
  WriteReview: {
    targetType: 'place' | 'route' | 'experience' | 'business';
    target: string;
    name: string;
    subtitle?: string;
  };
  StoryViewer: { username: string };
  UserProfile: { username: string };
  Followers: { username: string; tab?: 'followers' | 'following' };
  // Sprint 7.5 — bitmiş sprintlərdən qalan ekranlar
  Settings: undefined;
  EditProfile: undefined;
  Regions: undefined;
  PhotoGallery: { slug: string; name: string };
  ReviewsAll: {
    targetType: 'place' | 'route' | 'experience' | 'business';
    target: string;
    name: string;
  };
  FilterSheet: { region?: string; value?: import('@/screens/list/FilterSheetScreen').PlaceFilterValue };
  Legal: { slug: 'terms' | 'privacy' | 'expert-terms' };
  /** "Yarat" → "Check-in et": yaxınlıqdakı məkanlardan seçim. */
  CheckinPicker: undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type AppScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<AppStackParamList>
>;
