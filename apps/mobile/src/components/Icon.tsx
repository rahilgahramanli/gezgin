import Svg, { Circle, Path, type SvgProps } from 'react-native-svg';
import { colors } from '@gezgin/shared';

/**
 * İkon dəsti — `design/icons.js`-dəki SVG sprite-ın React Native qarşılığı.
 * Hamısı 24×24 şəbəkədə, `stroke` əsaslıdır ki, rəng `color` ilə idarə olunsun.
 */
export const ICONS = {
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35',
  pin: 'M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z',
  pinDot: 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM15.5 8.5l-2 5-5 2 2-5 5-2Z',
  map: 'M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4ZM9 4v13M15 6.5v13',
  user: 'M20 21v-1a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  chevronRight: 'M9 18l6-6-6-6',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronDown: 'M6 9l6 6 6-6',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  star: 'M12 3l2.7 5.5 6 .9-4.35 4.2 1.03 6L12 16.8 6.62 19.6l1.03-6L3.3 9.4l6-.9L12 3Z',
  heart: 'M19.5 5.5a5 5 0 0 0-7.5.6 5 5 0 0 0-7.5-.6 5.3 5.3 0 0 0 0 7.4l7.5 7.6 7.5-7.6a5.3 5.3 0 0 0 0-7.4Z',
  bookmark: 'M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3 6.5l9 6 9-6',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8 11V7a4 4 0 1 1 8 0v4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z',
  at: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 8v4.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1',
  calendar: 'M4 6h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM3 10h18M8 3v4M16 3v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.5 2',
  route: 'M6.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17.5 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6.5 9v3a4 4 0 0 0 4 4h3a4 4 0 0 1 4 2',
  mountain: 'M3 20l6.5-11 4 6 2.5-4L21 20H3Z',
  flag: 'M5 21V4M5 4h11l-2 3.5L16 11H5',
  camera: 'M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  chat: 'M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z',
  bell: 'M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6ZM10.5 20a1.8 1.8 0 0 0 3 0',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.6 1.6 0 0 0 .32 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-2.72 1.13V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.78-1.07l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 3.1 14.2H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.07-2.78l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9.8 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.78 1.07l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 20.9 9.8H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.2Z',
  trophy: 'M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4ZM6 6H4a2 2 0 0 0 0 4h2M18 6h2a2 2 0 0 1 0 4h-2',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9L18 16Z',
  coins: 'M9 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM15 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z',
  tree: 'M12 3 6 12h3l-4 6h14l-4-6h3L12 3ZM12 18v3',
  utensils: 'M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-1.5 1-2 3-2 5s.5 3 2 3v10',
  landmark: 'M4 21h16M5 21V10M9 21V10M15 21V10M19 21V10M3 10h18L12 3 3 10Z',
  wifiOff: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 3-2M19 13a10 10 0 0 0-8-2.8M12 20h.01',
  download: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  edit: 'M16 3.5a2.1 2.1 0 0 1 3 3L8 17.5 4 19l1.5-4L16 3.5Z',
  filter: 'M4 6h16M7 12h10M10 18h4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  navigation: 'M3 11l18-8-8 18-2-8-8-2Z',
  users: 'M16 21v-1a5 5 0 0 0-5-5H6a5 5 0 0 0-5 5v1M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-1a5 5 0 0 0-4-4.9M16 3.1a4 4 0 0 1 0 7.8',
  // Sprint 7 — lent və çat
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM21 15l-5-5L5 21',
  /** Üç nöqtə — `strokeWidth` 3 ilə çəkilir, əks halda nöqtələr görünmür. */
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  reply: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 5 5v6',
} as const;

export type IconName = keyof typeof ICONS;

export interface IconProps extends SvgProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Ulduz və ürək kimi doldurulan ikonlar üçün. */
  filled?: boolean;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 22,
  color = colors.ink,
  filled = false,
  strokeWidth = 1.8,
  ...rest
}: IconProps) {
  const d = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <Path
        d={d}
        stroke={filled ? 'none' : color}
        fill={filled ? color : 'none'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {name === 'pin' && !filled ? (
        <Circle cx={12} cy={10} r={2.5} stroke={color} strokeWidth={strokeWidth} fill="none" />
      ) : null}
      {name === 'eye' ? (
        <Circle cx={12} cy={12} r={3} stroke={filled ? 'none' : color} fill={filled ? color : 'none'} strokeWidth={strokeWidth} />
      ) : null}
    </Svg>
  );
}

/** GEZGIN loqosu — ekran 01 və başlıqlarda. */
export function LogoMark({ size = 48, color = colors.green900 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 1.22} viewBox="0 0 44 54" fill="none">
      <Path
        d="M22 2C11.5 2 3 10.5 3 21c0 13.5 19 31 19 31s19-17.5 19-31C41 10.5 32.5 2 22 2Z"
        fill={color}
      />
      <Path d="M12 26l6.5-8 5 6 3.5-4.5L34 26H12Z" fill="#fff" />
    </Svg>
  );
}
