/**
 * GEZGIN dizayn tokenləri — `design/gezgin.css` faylının tək mənbəyi.
 * Həm React Native (apps/mobile), həm admin panel bunları istifadə edir.
 * CSS dəyişəndə burada da dəyişməlidir.
 */

export const colors = {
  green900: '#0F3D3A',
  green800: '#154944',
  green700: '#1B5B55',
  green100: '#E4EEEB',
  green050: '#F0F5F3',
  teal400: '#33B8A3',
  brown700: '#7A4A28',
  brown500: '#9A5F35',
  brown100: '#F3E7DA',
  /** səhifə fonu — ağ */
  bg: '#FFFFFF',
  /** ikinci dərəcəli səthlər: input, progress track, segment */
  bg2: '#F3F1EC',
  paper: '#FFFFFF',
  ink: '#182726',
  ink2: '#2E3D3C',
  muted: '#6B7776',
  line: '#E6E1D8',
  star: '#F2A93B',
  danger: '#E14B3F',
  success: '#2E9E6B',
} as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, page: 20 } as const;

export const fonts = {
  display: 'Lexend',
  body: 'Inter',
  mono: 'JetBrainsMono',
} as const;

/** Ölçülər `design/gezgin.css` tipoqrafiya şkalasından götürülüb. */
export const typography = {
  titleXl: { fontFamily: fonts.display, fontSize: 28, fontWeight: '700', lineHeight: 32 },
  titleLg: { fontFamily: fonts.display, fontSize: 24, fontWeight: '700', lineHeight: 29 },
  h2: { fontFamily: fonts.display, fontSize: 19, fontWeight: '700', lineHeight: 24 },
  h3: { fontFamily: fonts.display, fontSize: 16, fontWeight: '600', lineHeight: 21 },
  body: { fontFamily: fonts.body, fontSize: 15, fontWeight: '400', lineHeight: 23 },
  small: { fontFamily: fonts.body, fontSize: 13, fontWeight: '400', lineHeight: 19 },
  meta: { fontFamily: fonts.body, fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 11, fontWeight: '400', lineHeight: 15 },
  tab: { fontFamily: fonts.body, fontSize: 11, fontWeight: '500', lineHeight: 14 },
} as const;

export const shadows = {
  sm: { shadowColor: '#182726', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  md: { shadowColor: '#182726', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  lg: { shadowColor: '#182726', shadowOpacity: 0.18, shadowRadius: 40, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
} as const;

/** Ekran 05–56-da işlənən 5 elementli tab bar. */
export const TAB_BAR_HEIGHT = 84;
export const PHONE = { width: 390, height: 844 } as const;

export const theme = { colors, radius, spacing, fonts, typography, shadows } as const;
export type Theme = typeof theme;
