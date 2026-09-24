/**
 * API kontrakt testi.
 *
 * Mobil tərəfin cavab tipləri əl ilə yazılır, çünki NestJS controller-ləri
 * `@ApiOkResponse({ type })` elan etmir — Swagger yalnız sorğu DTO-larını
 * sənədləşdirir, ona görə `openapi-typescript` cavab formalarını verə bilmir.
 *
 * Bu test ekranların ASILI OLDUĞU sahələrin canlı API-də həqiqətən mövcud
 * olduğunu yoxlayır. Beş dəfə forma uyğunsuzluğu (`?status=` əvəzinə
 * `?filter=`, `totalAzn` əvəzinə `pricing.totalAzn` və s.) yalnız simulyatorda
 * üzə çıxmışdı — bu test onları CI-də tutur.
 *
 * API işləmirsə testlər atlanılır (CI-də `docker compose up` tələb olunur).
 */

import { durationLabel } from '@/lib/labels';

const BASE = process.env.GEZGIN_API_URL ?? 'http://localhost:3100/api/v1';
const CREDENTIALS = { identifier: 'aysel.demo', password: 'Sifre12345' };

let token: string | null = null;
let apiUp = false;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  return (await res.json()) as T;
}

/** Obyektdə gözlənilən açarların hamısının olduğunu yoxlayır. */
function expectKeys(value: unknown, keys: string[], label: string): void {
  expect(value).toBeTruthy();
  const obj = value as Record<string, unknown>;
  const missing = keys.filter((k) => !(k in obj));
  expect({ [label]: missing }).toEqual({ [label]: [] });
}

beforeAll(async () => {
  try {
    const health = await fetch(`${BASE}/health`);
    apiUp = health.ok;
    if (!apiUp) return;
    const session = await call<{ accessToken?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(CREDENTIALS),
    });
    token = session.accessToken ?? null;
  } catch {
    apiUp = false;
  }
});

const t = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!apiUp) {
      console.warn('API işləmir — kontrakt testi atlanıldı');
      return;
    }
    await fn();
  });

describe('API kontraktı — mobil ekranların asılı olduğu sahələr', () => {
  t('/categories adı dil obyekti kimi qaytarır', async () => {
    const rows = await call<Array<{ slug: string; name: Record<string, string> }>>('/categories');
    expect(Array.isArray(rows)).toBe(true);
    expectKeys(rows[0], ['slug', 'name', 'icon', 'types'], 'categories');
    // `nameAz` DEYİL — dil açarları ilə obyektdir
    expect(typeof rows[0]?.name).toBe('object');
    expect(rows[0]?.name).toHaveProperty('az');
  });

  t('/places siyahısı kart sahələrini verir', async () => {
    const res = await call<{ data: unknown[] }>('/places?limit=1');
    expectKeys(res, ['data', 'nextOffset'], 'places');
    expectKeys(res.data[0], ['slug', 'name', 'rating', 'ratingCount', 'region', 'coverUrl'], 'place');
  });

  t('/places/:slug detal sahələrini verir', async () => {
    const p = await call('/places/xinaliq-kendi');
    expectKeys(p, ['slug', 'name', 'rating', 'reviewCount', 'photoCount', 'region', 'categories', 'photos', 'isSaved'], 'placeDetail');
  });

  t('/routes/:slug gün-gün planı verir', async () => {
    const r = await call<{ itinerary: Array<{ stops: unknown[] }> }>('/routes/quba-daglar-turu');
    expectKeys(r, ['slug', 'title', 'days', 'distanceKm', 'stopCount', 'itinerary', 'isSaved'], 'routeDetail');
    expectKeys(r.itinerary[0], ['day', 'stops'], 'itineraryDay');
    expectKeys(r.itinerary[0]?.stops[0], ['stopId', 'order', 'place'], 'stop');
  });

  t('hər `durationText` oxunaqlı etiketə çevrilir', async () => {
    const res = await call<{ data: Array<{ durationText: string | null }> }>('/experiences?limit=50');
    const values = [...new Set(res.data.map((e) => e.durationText).filter((v): v is string => !!v))];
    expect(values.length).toBeGreaterThan(0);
    // Slug ekrana olduğu kimi düşməməlidir — `yarim-gun` bir dəfə belə göstərilmişdi
    const raw = values.filter((v) => durationLabel(v) === v);
    expect({ tercumesizMuddet: raw }).toEqual({ tercumesizMuddet: [] });
  });

  t('/experiences/:slug qiymət bölgüsünü verir', async () => {
    const e = await call<{ pricing: unknown; gezginRewards: unknown }>('/experiences/kend-metbexi-masterklassi');
    expectKeys(e, ['slug', 'title', 'pricing', 'gezginRewards', 'expert', 'includes', 'isSaved'], 'experienceDetail');
    expectKeys(e.pricing, ['priceAzn', 'expertEarnsAzn', 'platformFeeAzn', 'expertRate'], 'pricing');
    expectKeys(e.gezginRewards, ['experienceXp', 'bookingXp', 'reviewXp'], 'rewards');
  });

  t('saxla/götür detaldakı `isSaved` ilə uyğun gəlir', async () => {
    // Saxla düyməsi vəziyyətsiz idi: hər toxunuş POST göndərirdi, ikon heç dəyişmirdi.
    const slug = 'xinaliq-kendi';
    const before = await call<{ isSaved: boolean }>(`/places/${slug}`);
    if (before.isSaved) await call(`/saved/place/${slug}`, { method: 'DELETE' });

    await call('/saved', { method: 'POST', body: JSON.stringify({ type: 'place', target: slug }) });
    const saved = await call<{ isSaved: boolean }>(`/places/${slug}`);
    expect(saved.isSaved).toBe(true);

    await call(`/saved/place/${slug}`, { method: 'DELETE' });
    const unsaved = await call<{ isSaved: boolean }>(`/places/${slug}`);
    expect(unsaved.isSaved).toBe(false);

    if (before.isSaved) {
      await call('/saved', { method: 'POST', body: JSON.stringify({ type: 'place', target: slug }) });
    }
  });

  t('/experiences/:slug/availability slot sahələrini verir', async () => {
    const a = await call<{ slots: unknown[] }>('/experiences/kend-metbexi-masterklassi/availability?days=90');
    expectKeys(a, ['defaultPriceAzn', 'slots'], 'availability');
    if (a.slots.length) {
      expectKeys(a.slots[0], ['slotId', 'startAt', 'seatsLeft', 'capacity', 'isFull'], 'slot');
    }
  });

  t('/me profil və gamification sahələrini verir', async () => {
    const me = await call<{ gamification: unknown }>('/me');
    expectKeys(me, ['username', 'fullName', 'avatarUrl', 'interests', 'gamification', 'onboardingCompleted'], 'me');
    expectKeys(me.gamification, ['level', 'tier', 'xp', 'xpInLevel', 'xpForLevel', 'xpToNext', 'percent', 'gezginScore'], 'gamification');
  });

  t('/me/score xal qazanma qaydalarını verir', async () => {
    const s = await call<{ earnRules: unknown[] }>('/me/score');
    expectKeys(s, ['gezginScore', 'trendPercent', 'level', 'tier', 'xpToNext', 'percent', 'last30Days', 'earnRules'], 'score');
    expectKeys(s.earnRules[0], ['action', 'name', 'xp', 'dailyCap'], 'earnRule');
  });

  t('/me/badges tərəqqi sahələrini verir', async () => {
    const b = await call<{ badges: unknown[] }>('/me/badges');
    expectKeys(b, ['earnedCount', 'totalCount', 'badges'], 'badges');
    expectKeys(b.badges[0], ['slug', 'name', 'conditionValue', 'progress', 'percent', 'earned'], 'badge');
  });

  t('/leaderboard sıra sahələrini verir', async () => {
    const l = await call<{ entries: unknown[] }>('/leaderboard?period=weekly');
    expectKeys(l, ['period', 'podium', 'entries', 'me'], 'leaderboard');
    if (l.entries.length) {
      expectKeys(l.entries[0], ['rank', 'username', 'fullName', 'level', 'points', 'isMe'], 'entry');
    }
  });

  t('/trips siyahısı tərəqqi sahələrini verir', async () => {
    const res = await call<{ data: unknown[] }>('/trips');
    expectKeys(res.data[0], ['publicId', 'title', 'status', 'dayCount', 'itemCount', 'doneCount', 'progressPercent'], 'trip');
  });

  t('/saved sayğacları və elementləri verir', async () => {
    const s = await call<{ counts: unknown; data: unknown[] }>('/saved');
    expectKeys(s, ['counts', 'data', 'nextOffset'], 'saved');
    expectKeys(s.counts, ['all', 'place', 'route', 'experience', 'event'], 'savedCounts');
  });

  describe('rezervasiya — beş uyğunsuzluğun tapıldığı yer', () => {
    t('GET /bookings `filter` parametrini qəbul edir (`status` yox)', async () => {
      const withFilter = await call<{ data: unknown[] }>('/bookings?filter=upcoming');
      expect(Array.isArray(withFilter.data)).toBe(true);

      // `status` düzgün ad olsaydı, bu da nəticə qaytarardı
      const withStatus = await call<{ data?: unknown[]; statusCode?: number }>('/bookings?status=upcoming');
      expect(withStatus.data).toBeUndefined();
    });

    t('rezervasiya qiyməti `pricing` içindədir', async () => {
      const res = await call<{ data: Array<{ pricing: unknown }> }>('/bookings?filter=upcoming');
      const booking = res.data[0];
      if (!booking) return;
      expectKeys(booking, ['publicId', 'code', 'status', 'title', 'adults', 'children', 'pricing'], 'booking');
      expectKeys(booking.pricing, ['lines', 'subtotalAzn', 'totalAzn'], 'bookingPricing');
      // Kök səviyyədə `totalAzn` YOXDUR
      expect((booking as Record<string, unknown>).totalAzn).toBeUndefined();
    });

    t('bilet `guests` obyektini qaytarır', async () => {
      const res = await call<{ data: Array<{ publicId: string; status: string }> }>('/bookings?filter=upcoming');
      const confirmed = res.data.find((b) => b.status === 'confirmed');
      if (!confirmed) return;

      const ticket = await call<{ guests: unknown }>(`/bookings/${confirmed.publicId}/ticket`);
      expectKeys(ticket, ['code', 'qrPayload', 'title', 'guests', 'totalAzn', 'status'], 'ticket');
      expectKeys(ticket.guests, ['adults', 'children'], 'guests');
    });

    t('quote qiymət sətirlərini və komissiyanı verir', async () => {
      const q = await call<{ lines: unknown[]; commission: unknown }>('/bookings/quote', {
        method: 'POST',
        body: JSON.stringify({ type: 'experience', target: 'kend-metbexi-masterklassi', adults: 2 }),
      });
      expectKeys(q, ['lines', 'subtotalAzn', 'totalAzn', 'commission'], 'quote');
      expectKeys(q.lines[0], ['code', 'label', 'quantity', 'unitAzn', 'totalAzn'], 'quoteLine');
      expectKeys(q.commission, ['expertEarnsAzn', 'platformFeeAzn', 'rate'], 'commission');
    });

    t('ödəniş məbləği `amountAzn`-dır (`paidAzn` yoxdur)', async () => {
      const res = await call<{ data: Array<{ publicId: string; status: string }> }>('/bookings?filter=upcoming');
      const paid = res.data.find((b) => b.status === 'confirmed');
      if (!paid) return;

      const booking = await call<{ payment: Record<string, unknown> | null }>(`/bookings/${paid.publicId}`);
      if (!booking.payment) return;
      expectKeys(booking.payment, ['publicId', 'status', 'amountAzn', 'refundedAzn', 'paidAt'], 'payment');
      expect(booking.payment.paidAzn).toBeUndefined();
    });
  });

  /** Ekran 49 — otel paketi rezervasiyası. */
  describe('otel paketi (ekran 49)', () => {
    t('quote `nights` verir, komissiya isə `null`-dur', async () => {
      const business = await call<{ packages: Array<{ publicId: string; nights: number }> }>(
        '/businesses/gabala-resort-spa',
      );
      const pkg = business.packages[0];
      expect(pkg).toBeTruthy();
      if (!pkg) return;

      const startAt = new Date(Date.now() + 7 * 86400_000).toISOString();
      const q = await call<{ nights: number; commission: unknown; lines: Array<{ code: string }> }>(
        '/bookings/quote',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'business_package',
            target: pkg.publicId,
            adults: 2,
            startAt,
            extras: ['spa'],
          }),
        },
      );
      expectKeys(q, ['type', 'title', 'lines', 'totalAzn', 'nights', 'rewards'], 'hotelQuote');
      expect(q.nights).toBe(pkg.nights);
      // Otel paketində Local Expert payı yoxdur
      expect(q.commission).toBeNull();
      // Qiymət nəfər başına deyil, paket başınadır
      expect(q.lines.some((l) => l.code === 'package')).toBe(true);
      expect(q.lines.some((l) => l.code === 'adult')).toBe(false);
    });

    t('biznes paketi ekranın gözlədiyi sahələri verir', async () => {
      const b = await call<{ packages: unknown[] }>('/businesses/gabala-resort-spa');
      expectKeys(b, ['slug', 'name', 'type', 'region', 'services', 'photos', 'packages'], 'business');
      expectKeys(b.packages[0], ['publicId', 'title', 'nights', 'days', 'priceAzn', 'includes'], 'package');
    });
  });

  /** Ekran 50 — marşrut qurucu. */
  describe('marşrut qurucu (ekran 50)', () => {
    t('yarat → dayanacaq əlavə et → sırala → sil', async () => {
      const created = await call<{ slug: string; visibility: string; days: number; rewards: unknown }>('/routes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Kontrakt testi marşrutu', region: 'quba', days: 2, difficulty: 'asan' }),
      });
      expectKeys(created, ['slug', 'title', 'days', 'visibility', 'isOwner', 'itinerary', 'rewards'], 'createdRoute');
      // Ekran 50 toggle-ı `visibility` sahəsini oxuyur
      expect(created.visibility).toBe('private');
      expect(created.days).toBe(2);

      try {
        const withOne = await call<{ itinerary: Array<{ day: number; stops: Array<{ stopId: number }> }> }>(
          `/routes/${created.slug}/stops`,
          { method: 'POST', body: JSON.stringify({ place: 'xinaliq-kendi', day: 1 }) },
        );
        const withTwo = await call<{ itinerary: Array<{ day: number; stops: Array<{ stopId: number }> }> }>(
          `/routes/${created.slug}/stops`,
          { method: 'POST', body: JSON.stringify({ place: 'nohurgol', day: 1 }) },
        );
        void withOne;

        const day1 = withTwo.itinerary.find((d) => d.day === 1);
        expect(day1?.stops.length).toBe(2);
        const ids = (day1?.stops ?? []).map((s) => s.stopId);

        // Tərs sıra — ekran 50 yuxarı/aşağı düymələri bu formanı göndərir
        const reordered = await call<{ itinerary: Array<{ day: number; stops: Array<{ stopId: number }> }> }>(
          `/routes/${created.slug}/stops/reorder`,
          {
            method: 'PUT',
            body: JSON.stringify({
              stops: [...ids].reverse().map((stopId, i) => ({ stopId, day: 1, order: i })),
            }),
          },
        );
        expect(reordered.itinerary.find((d) => d.day === 1)?.stops.map((s) => s.stopId)).toEqual([...ids].reverse());

        const madePublic = await call<{ visibility: string }>(`/routes/${created.slug}`, {
          method: 'PATCH',
          body: JSON.stringify({ isPublic: true }),
        });
        expect(madePublic.visibility).toBe('public');
      } finally {
        await call(`/routes/${created.slug}`, { method: 'DELETE' });
      }
    });

    t('/routes/mine `visibility` ilə birlikdə qaytarır', async () => {
      const mine = await call<{ data: unknown[] }>('/routes/mine');
      expectKeys(mine, ['data', 'nextOffset'], 'myRoutes');
      if (mine.data.length) {
        expectKeys(mine.data[0], ['slug', 'title', 'days', 'stopCount', 'visibility'], 'myRoute');
      }
    });
  });

  /** Sprint 7 — sosial lent, hekayə, profil, çat, bildiriş. */
  describe('sosial (ekran 05–09, 40–42)', () => {
    t('/feed kart sahələrini verir', async () => {
      const res = await call<{ data: Array<Record<string, unknown>> }>('/feed?limit=5');
      expectKeys(res, ['tab', 'data', 'nextCursor'], 'feed');
      const post = res.data[0];
      expectKeys(
        post,
        ['publicId', 'body', 'hashtags', 'visibility', 'createdAt', 'author', 'media', 'place', 'route', 'location', 'counts', 'viewer'],
        'post',
      );
      expectKeys(post?.author, ['username', 'fullName', 'avatarUrl', 'level', 'tier', 'isLocalExpert'], 'postAuthor');
      expectKeys(post?.counts, ['likes', 'comments', 'shares', 'saves'], 'postCounts');
      expectKeys(post?.viewer, ['liked', 'saved', 'followsAuthor', 'isMine'], 'postViewer');
    });

    t('Nearby hər paylaşıma məsafə əlavə edir', async () => {
      const res = await call<{ data: Array<Record<string, unknown>> }>('/feed?tab=nearby&lat=41.1897&lng=48.0169&radiusKm=30');
      if (!res.data.length) return;
      expectKeys(res.data[0], ['distanceKm'], 'nearbyPost');
    });

    t('şərhlər bir səviyyəli ağacdır', async () => {
      const feed = await call<{ data: Array<{ publicId: string; counts: { comments: number } }> }>('/feed?limit=20');
      const withComments = feed.data.find((p) => p.counts.comments > 0);
      if (!withComments) return;
      const res = await call<{ data: Array<Record<string, unknown>> }>(`/posts/${withComments.publicId}/comments`);
      expectKeys(res, ['data', 'nextCursor', 'total'], 'comments');
      expectKeys(
        res.data[0],
        ['publicId', 'body', 'createdAt', 'likeCount', 'liked', 'isMine', 'canDelete', 'author', 'replies'],
        'comment',
      );
    });

    t('/stories dairə sahələrini verir', async () => {
      const res = await call<{ data: unknown[] }>('/stories');
      expectKeys(res, ['data', 'hasMine'], 'stories');
      if (res.data.length) {
        expectKeys(res.data[0], ['user', 'storyCount', 'hasUnseen', 'latestAt', 'coverUrl', 'isMine'], 'storyRing');
      }
    });

    t('/users/:username profil sahələrini verir', async () => {
      const u = await call<Record<string, unknown>>('/users/aysel.go');
      expectKeys(
        u,
        ['username', 'fullName', 'avatarUrl', 'level', 'tier', 'bio', 'coverUrl', 'homeRegion', 'gezginScore', 'stats', 'viewer', 'canViewContent'],
        'userProfile',
      );
      expectKeys(u.stats, ['posts', 'followers', 'following', 'routes', 'badges'], 'userStats');
      expectKeys(u.viewer, ['isMe', 'isFollowing', 'followsYou', 'canMessage'], 'userViewer');
    });

    t('izləyici siyahısı offset səhifələmədir', async () => {
      const res = await call<{ data: unknown[] }>('/users/aysel.go/followers');
      expectKeys(res, ['data', 'nextOffset', 'total'], 'followers');
      if (res.data.length) expectKeys(res.data[0], ['username', 'fullName', 'isFollowing', 'isMe'], 'followRow');
    });

    t('/notifications oxunmamış sayğacı ilə', async () => {
      const res = await call<Record<string, unknown>>('/notifications?limit=5');
      expectKeys(res, ['data', 'nextCursor', 'unreadCount'], 'notifications');
    });

    t('/conversations oxunmamış cəmi ilə', async () => {
      const res = await call<Record<string, unknown>>('/conversations');
      expectKeys(res, ['data', 'nextOffset', 'total', 'unreadTotal'], 'conversations');
    });

    t('/users/suggested səbəb göstərir', async () => {
      const res = await call<{ data: unknown[] }>('/users/suggested');
      expectKeys(res, ['data'], 'suggested');
      if (res.data.length) expectKeys(res.data[0], ['username', 'fullName', 'reason', 'isFollowing'], 'suggestedUser');
    });
  });

  /** Ekran 12 xəritə rejimi. */
  describe('xəritə (ekran 12)', () => {
    t('yüksək zoom fərdi pinlər qaytarır', async () => {
      const res = await call<{ mode: string; items: unknown[] }>('/places/map?zoom=14');
      expect(res.mode).toBe('points');
      if (res.items.length) {
        expectKeys(res.items[0], ['slug', 'name', 'lat', 'lng', 'rating', 'category'], 'mapPoint');
      }
    });

    t('aşağı zoom klaster qaytarır', async () => {
      const res = await call<{ mode: string; items: unknown[] }>('/places/map?zoom=6');
      expect(res.mode).toBe('clusters');
      if (res.items.length) {
        expectKeys(res.items[0], ['count', 'lat', 'lng', 'sampleName'], 'mapCluster');
      }
    });

    t('bbox formatı minLng,minLat,maxLng,maxLat-dır', async () => {
      const ok = await call<{ items: unknown[] }>('/places/map?zoom=14&bbox=47.9,41.1,48.6,41.5');
      expect(Array.isArray(ok.items)).toBe(true);

      const bad = await call<{ code?: string }>('/places/map?zoom=14&bbox=1,2,3');
      expect(bad.code).toBe('VALIDATION_FAILED');
    });
  });
});
