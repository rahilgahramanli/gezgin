import { EmptyState, Screen } from '@/components';

/** Hələ qurulmamış tablar üçün — növbəti sprintlərdə doldurulur. */
export function PlaceholderScreen() {
  return (
    <Screen scroll={false}>
      <EmptyState title="Tezliklə" message="Bu bölmə növbəti sprintdə qurulacaq." />
    </Screen>
  );
}
