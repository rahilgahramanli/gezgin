/**
 * Ödəniş axınının inteqrasiya testi — `useCheckout` canlı API-yə qarşı.
 *
 * QA-da: hər "Ödə" toxunuşu yeni rezervasiya yaradırdı (təsadüfi
 * Idempotency-Key), rədd olunan kartın xətası görünmürdü, 3-D Secure isə heç
 * işlənmirdi. Burada birdəfəlik istifadəçi ilə real axın yoxlanılır:
 * rədd → başqa kart → 3-D Secure (səhv, sonra düz kod) → EYNİ rezervasiya təsdiqlənir.
 *
 * API işləmirsə test atlanılır (kontrakt testi kimi).
 */
import { act, createElement } from 'react';
import { create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { setAccessToken } from '@/api/client';
import { useCheckout } from '@/screens/booking/parts/useCheckout';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
  Alert: { alert: jest.fn() },
}));
// Klient testdə də eyni API-yə getsin (`GEZGIN_API_URL` ilə dəyişdirilə bilir)
jest.mock('@/config/env', () => ({
  env: { apiUrl: process.env.GEZGIN_API_URL ?? 'http://localhost:3100/api/v1', isDev: true },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

const BASE = process.env.GEZGIN_API_URL ?? 'http://localhost:3100/api/v1';
const EXPERIENCE = 'kend-metbexi-masterklassi';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Hook-u render etmək üçün ən sadə yol budur; köhnəlmə xəbərdarlığı test çıxışını doldurmasın
const consoleError = console.error.bind(console);
jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  if (String(args[0]).includes('react-test-renderer is deprecated')) return;
  consoleError(...args);
});
// react-query bildirişləri sinxron gəlsin — `act` xaricində yeniləmə olmasın
notifyManager.setScheduler((cb) => cb());

let apiUp = false;
let token = '';

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  });
  return (await res.json()) as T;
}

const cards: Record<'declined' | 'threeDs' | 'success', string> = { declined: '', threeDs: '', success: '' };
let slotId = 0;

beforeAll(async () => {
  try {
    apiUp = (await fetch(`${BASE}/health`)).ok;
  } catch {
    apiUp = false;
  }
  if (!apiUp) return;

  const tag = `co${Date.now().toString(36)}`;
  const session = await call<{ accessToken: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName: 'Checkout Testi', username: tag, email: `${tag}@gezgin.test`, password: 'Sifre12345' }),
  });
  token = session.accessToken;
  setAccessToken(token);

  const add = async (number: string) =>
    (
      await call<{ publicId: string }>('/payments/methods', {
        method: 'POST',
        body: JSON.stringify({ number, expMonth: 12, expYear: 2030, cvv: '123' }),
      })
    ).publicId;
  cards.declined = await add('4000000000000002');
  cards.threeDs = await add('4000000000003220');
  cards.success = await add('4111111111111111');

  const avail = await call<{ slots: Array<{ slotId: number; seatsLeft: number; startAt: string }> }>(
    `/experiences/${EXPERIENCE}/availability?days=90`,
  );
  // 48 saatdan uzaq, ən azı 3 boş yeri olan slot — ləğvdə yer tam qayıdır
  slotId =
    avail.slots.find((s) => s.seatsLeft >= 3 && Date.parse(s.startAt) > Date.now() + 3 * 86_400_000)?.slotId ?? 0;
});

afterAll(async () => {
  if (!apiUp || !token) return;
  // Tutulmuş yerləri boşaldırıq
  const list = await call<{ data: Array<{ publicId: string; cancellation: { canCancel: boolean } }> }>(
    '/bookings?filter=upcoming',
  );
  for (const b of list.data) {
    if (b.cancellation.canCancel) await call(`/bookings/${b.publicId}/cancel`, { method: 'POST', body: '{}' });
  }
  setAccessToken(null);
});

type Checkout = ReturnType<typeof useCheckout>;

function mount(onConfirmed: (id: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const ref: { current: Checkout | null } = { current: null };
  function Probe() {
    ref.current = useCheckout({ onConfirmed });
    return null;
  }
  let renderer: { unmount: () => void } | null = null;
  act(() => {
    renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe)));
  });
  return {
    get: () => ref.current as Checkout,
    unmount: () => act(() => renderer?.unmount()),
  };
}

const counts = () =>
  call<{ counts: { upcoming: number; cancelled: number } }>('/bookings?filter=upcoming').then((r) => r.counts);

const live = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!apiUp || !slotId) {
      console.warn('API və ya boş slot yoxdur — ödəniş axını testi atlanıldı');
      return;
    }
    await fn();
  }, 30_000);

describe('useCheckout — canlı ödəniş axını', () => {
  live('rədd → 3-D Secure (səhv/düz kod) eyni rezervasiyanı təsdiqləyir', async () => {
    const confirmed: string[] = [];
    const c = mount((id) => confirmed.push(id));
    const input = { type: 'experience' as const, target: EXPERIENCE, adults: 1, children: 0, slotId };

    await act(() => c.get().submit(input, cards.declined));
    expect(c.get().error).toBe('Kartda kifayət qədər vəsait yoxdur');
    expect(confirmed).toEqual([]);
    expect((await counts()).upcoming).toBe(1);
    // Ekran bu yerləri "öz tutduğumuz" kimi boş yerə geri əlavə edir
    expect(c.get().pending).toMatchObject({ slotId, adults: 1 });

    // Başqa kartla təkrar — yeni rezervasiya YARANMIR
    await act(() => c.get().submit(input, cards.threeDs));
    expect(c.get().error).toBeNull();
    expect(c.get().otp).toMatchObject({ methodId: cards.threeDs, wrong: false });
    expect((await counts()).upcoming).toBe(1);

    await act(() => c.get().submitOtp('000000'));
    expect(c.get().otp).toMatchObject({ wrong: true });
    expect(confirmed).toEqual([]);

    await act(() => c.get().submitOtp('123456'));
    expect(c.get().otp).toBeNull();
    expect(confirmed).toHaveLength(1);

    const list = await call<{ counts: { upcoming: number }; data: Array<{ publicId: string; status: string }> }>(
      '/bookings?filter=upcoming',
    );
    expect(list.counts.upcoming).toBe(1);
    expect(list.data[0]).toMatchObject({ publicId: confirmed[0], status: 'confirmed' });
    c.unmount();
  });

  live('parametrlər dəyişəndə köhnə ödənilməmiş rezervasiya ləğv edilir', async () => {
    const before = await counts();
    const confirmed: string[] = [];
    const c = mount((id) => confirmed.push(id));
    const base = { type: 'experience' as const, target: EXPERIENCE, children: 0, slotId };

    await act(() => c.get().submit({ ...base, adults: 1 }, cards.declined));
    expect(c.get().error).toBe('Kartda kifayət qədər vəsait yoxdur');

    await act(() => c.get().submit({ ...base, adults: 2 }, cards.success));
    expect(confirmed).toHaveLength(1);

    // Köhnə rezervasiyanın ləğvi arxa planda gedir
    let after = await counts();
    for (let i = 0; i < 20 && after.cancelled === before.cancelled; i += 1) {
      await new Promise((r) => setTimeout(r, 150));
      after = await counts();
    }
    expect(after.cancelled).toBe(before.cancelled + 1);
    expect(after.upcoming).toBe(before.upcoming + 1);
    c.unmount();
  });
});
