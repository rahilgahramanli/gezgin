import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, Loading, Screen, Text, TopBar } from '@/components';
import { api } from '@/api/client';
import { t } from '@/theme';
import type { AppScreenProps } from '@/navigation/types';

interface LegalDoc {
  slug: string;
  titleAz: string;
  version: string;
  updatedAt: string;
  sections: Array<{ heading: string; body: string }>;
}

/** İstifadə şərtləri, məxfilik siyasəti — tətbiqin içində oxunur. */
export function LegalScreen({ route, navigation }: AppScreenProps<'Legal'>) {
  const { slug } = route.params;
  const doc = useQuery({ queryKey: ['legal', slug], queryFn: () => api<LegalDoc>(`/legal/${slug}`) });

  if (doc.error) return <ErrorState error={doc.error} onRetry={() => void doc.refetch()} onBack={navigation.goBack} />;

  return (
    <Screen>
      <TopBar title={doc.data?.titleAz ?? 'Sənəd'} onBack={navigation.goBack} />
      {!doc.data ? (
        <Loading />
      ) : (
        <View>
          <Text variant="meta" style={styles.meta}>
            Versiya {doc.data.version} · {doc.data.updatedAt}
          </Text>
          {doc.data.sections.map((s) => (
            <View key={s.heading} style={styles.section}>
              <Text variant="h3">{s.heading}</Text>
              <Text variant="body" style={styles.body}>
                {s.body}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { marginBottom: t.spacing.md },
  section: { marginBottom: t.spacing.lg },
  body: { marginTop: 6, lineHeight: 22 },
});
