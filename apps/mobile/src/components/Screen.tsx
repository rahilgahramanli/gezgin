import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { t } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ScreenProps {
  children: ReactNode;
  /** Kontent scroll olunsun (defolt) və ya sabit qalsın. */
  scroll?: boolean;
  /** Səhifə kənar boşluqları — hero ekranlarda söndürülür. */
  padded?: boolean;
  edges?: readonly Edge[];
  backgroundColor?: string;
  contentStyle?: ViewStyle;
  /** Alt CTA panelinə yer buraxır. */
  bottomInset?: number;
  /**
   * Ekranın altına yapışan panel (CTA düyməsi).
   *
   * ScrollView-dən KƏNARDA render olunur — əks halda `position:absolute`
   * scroll kontentinə görə hesablanır və düymə qısa ekranda ortada asılı
   * qalır, uzun ekranda isə yalnız sona sürüşdürəndə görünür.
   */
  footer?: ReactNode;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top'],
  backgroundColor = t.colors.bg,
  contentStyle,
  bottomInset = 0,
  footer,
}: ScreenProps) {
  const inner: ViewStyle = {
    ...(padded ? { paddingHorizontal: t.spacing.page } : null),
    paddingBottom: bottomInset + t.spacing.xxl,
    ...contentStyle,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={inner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/** Yüklənmə vəziyyəti — siyahı və detal ekranlarında. */
export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={t.colors.green900} />
      {label ? (
        <Text variant="meta" style={{ marginTop: t.spacing.md }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** Boş və ya xəta vəziyyəti. */
export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  /** Quru mətn əvəzinə kontekst verən işarə. */
  icon?: IconName;
}) {
  return (
    <View style={styles.center}>
      {icon ? (
        <View style={styles.emptyIcon}>
          <Icon name={icon} size={26} color={t.colors.green900} />
        </View>
      ) : null}
      <Text variant="h2" center>
        {title}
      </Text>
      {message ? (
        <Text variant="meta" center style={{ marginTop: 6, maxWidth: 280 }}>
          {message}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: t.spacing.lg }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xxl, minHeight: 200 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.green050,
    alignItems: 'center', justifyContent: 'center', marginBottom: t.spacing.md,
  },
  footer: {
    padding: t.spacing.page,
    paddingBottom: 32,
    backgroundColor: t.colors.bg,
    borderTopWidth: 1,
    borderTopColor: t.colors.line,
  },
});
