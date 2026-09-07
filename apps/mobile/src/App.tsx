import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { RootNavigator } from '@/navigation/RootNavigator';
import '@/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 1000 * 30 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
