import { colors, radius, spacing, typography, shadows, fonts } from '@gezgin/shared';

/**
 * Dizayn tokenləri `@gezgin/shared`-dən gəlir — tək mənbə `design/gezgin.css`.
 * Burada yalnız React Native-ə xas əlavələr var.
 */
export const t = { colors, radius, spacing, typography, shadows, fonts };

/** Ekran 05–56: 5 elementli tab bar, ortada FAB. */
export const TAB_BAR_HEIGHT = 84;

export type ColorToken = keyof typeof colors;
