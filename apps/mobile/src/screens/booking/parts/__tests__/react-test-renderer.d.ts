/**
 * `@types/react-test-renderer` qurulmayıb (yeni asılılıq əlavə etmirik) —
 * yalnız ödəniş axını testinin işlətdiyi hissə. `act` birbaşa `react`-dan gəlir.
 */
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export function create(element: ReactElement): { unmount(): void };
}
