import { QueryClient } from '@tanstack/react-query';

/**
 * Tətbiqin yeganə sorğu keşi. Modul səviyyəsində ixrac olunur ki, hook olmayan
 * yerlər (sessiya store-u, dil dəyişimi) onu təmizləyə/yeniləyə bilsin.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 1000 * 30 },
  },
});
