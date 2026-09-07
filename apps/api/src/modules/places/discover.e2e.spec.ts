import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { uniqueTag } from '@/common/testing/unique-tag';
import { PrismaService } from '@/common/prisma/prisma.service';
import { foldAz, toBooleanQuery } from '@/common/search/normalize';

/** Quba şəhər mərkəzi — seed datasındakı koordinat. */
const QUBA = { lat: 41.3606, lng: 48.5128 };

describe('Kəşf: regions + places + search + reviews (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const tag = uniqueTag();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      fullName: 'Kəşf Testi',
      username: `kesf.${tag}`,
      email: `kesf.${tag}@gezgin.test`,
      password: 'Sifre12345',
    });
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: `kesf.${tag}@gezgin.test` } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('normalizasiya (vahid)', () => {
    it('ə və ı hərflərini e və i-yə çevirir', () => {
      expect(foldAz('Xınalıq kəndi')).toBe('xinaliq kendi');
      expect(foldAz('Şəhər')).toBe('şeher');
    });

    it('BOOLEAN MODE sorğusuna prefiks əlavə edir və qısa sözləri atır', () => {
      expect(toBooleanQuery('kənd turu')).toBe('kend* turu*');
      expect(toBooleanQuery('bu və')).toBeNull();
    });

    it('BOOLEAN MODE operatorlarını təmizləyir', () => {
      expect(toBooleanQuery('quba +(-test)')).toBe('quba* test*');
    });
  });

  describe('regions', () => {
    it('regionları məkan sayı ilə qaytarır', async () => {
      const res = await http().get('/api/v1/regions').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      const quba = res.body.find((r: { slug: string }) => r.slug === 'quba');
      expect(quba.name).toBe('Quba');
      expect(quba.placeCount).toBeGreaterThan(0);
    });

    it('region detalında say göstəriciləri var', async () => {
      const res = await http().get('/api/v1/regions/quba').expect(200);
      expect(res.body.counts.places).toBeGreaterThan(0);
      expect(res.body.counts.routes).toBeGreaterThan(0);
    });

    it('mövcud olmayan region üçün 404', async () => {
      const res = await http().get('/api/v1/regions/yoxdur').expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('Accept-Language ilə ingilis adı qaytarır', async () => {
      const res = await http().get('/api/v1/regions').set('Accept-Language', 'en').expect(200);
      expect(res.body.find((r: { slug: string }) => r.slug === 'baki').name).toBe('Baku');
    });
  });

  describe('places — coğrafi sorğular', () => {
    it('radius daxilində məsafəyə görə sıralayır', async () => {
      const res = await http()
        .get(`/api/v1/places?lat=${QUBA.lat}&lng=${QUBA.lng}&radiusKm=30&sort=distance`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      const distances = res.body.data.map((p: { distanceKm: number }) => p.distanceKm);
      expect(distances).toEqual([...distances].sort((a, b) => a - b));
      expect(Math.max(...distances)).toBeLessThanOrEqual(30);
    });

    it('radiusdan kənardakıları çıxarır', async () => {
      const wide = await http().get(`/api/v1/places?lat=${QUBA.lat}&lng=${QUBA.lng}&radiusKm=200`).expect(200);
      const narrow = await http().get(`/api/v1/places?lat=${QUBA.lat}&lng=${QUBA.lng}&radiusKm=10`).expect(200);
      expect(wide.body.data.length).toBeGreaterThan(narrow.body.data.length);
    });

    it('yaxınlıqdakı məkanları özündən başqa qaytarır', async () => {
      const res = await http().get('/api/v1/places/xinaliq-kendi/nearby?radiusKm=60').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.some((p: { slug: string }) => p.slug === 'xinaliq-kendi')).toBe(false);
      expect(res.body[0].distanceKm).toBeGreaterThan(0);
    });
  });

  describe('places — axtarış', () => {
    it('ASCII yazılışla Azərbaycan mətnini tapır', async () => {
      const ascii = await http().get('/api/v1/places?q=xinaliq').expect(200);
      expect(ascii.body.data.map((p: { slug: string }) => p.slug)).toContain('xinaliq-kendi');
    });

    it('şəkilçili sözü kökü ilə tapır', async () => {
      const res = await http().get('/api/v1/places?q=kend').expect(200);
      expect(res.body.data.map((p: { slug: string }) => p.slug)).toContain('xinaliq-kendi');
    });

    it('Azərbaycan hərfləri ilə də eyni nəticəni verir', async () => {
      const ascii = await http().get('/api/v1/places?q=xinaliq').expect(200);
      const azeri = await http().get(`/api/v1/places?q=${encodeURIComponent('xınalıq')}`).expect(200);
      expect(azeri.body.data[0].slug).toBe(ascii.body.data[0].slug);
    });
  });

  describe('places — filtrlər', () => {
    it('kateqoriyaya görə filtrləyir', async () => {
      const res = await http().get('/api/v1/places?categories=tarix').expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const slugs = res.body.data.map((p: { slug: string }) => p.slug);
      expect(slugs).toContain('icherisheher');
      expect(slugs).not.toContain('nohurgol');
    });

    it('minimal reytinqə görə filtrləyir', async () => {
      const res = await http().get('/api/v1/places?minRating=4.7').expect(200);
      for (const p of res.body.data) expect(p.rating).toBeGreaterThanOrEqual(4.7);
    });

    it('reytinqə görə azalan sıralayır', async () => {
      const res = await http().get('/api/v1/places?sort=rating').expect(200);
      const ratings = res.body.data.map((p: { rating: number }) => p.rating);
      expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    });

    it('səhifələmə nextOffset verir', async () => {
      const first = await http().get('/api/v1/places?limit=3').expect(200);
      expect(first.body.data).toHaveLength(3);
      expect(first.body.nextOffset).toBe(3);

      const second = await http().get('/api/v1/places?limit=3&offset=3').expect(200);
      expect(second.body.data[0].slug).not.toBe(first.body.data[0].slug);
    });

    it('filtr seçimlərini qaytarır', async () => {
      const res = await http().get('/api/v1/places/filters').expect(200);
      expect(res.body.categories.length).toBeGreaterThan(0);
      expect(res.body.priceLevels).toHaveLength(4);
      expect(res.body.totalPlaces).toBeGreaterThan(0);
    });
  });

  describe('places — xəritə', () => {
    it('yüksək zoom-da fərdi pinlər verir', async () => {
      const res = await http().get('/api/v1/places/map?zoom=14&bbox=47.9,41.1,48.6,41.5').expect(200);
      expect(res.body.mode).toBe('points');
      expect(res.body.items[0]).toHaveProperty('slug');
    });

    it('aşağı zoom-da klasterləyir', async () => {
      const res = await http().get('/api/v1/places/map?zoom=6').expect(200);
      expect(res.body.mode).toBe('clusters');
      expect(res.body.items[0]).toHaveProperty('count');
    });

    it('yanlış bbox formatını rədd edir', async () => {
      const res = await http().get('/api/v1/places/map?bbox=yanlis').expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('bbox görünüşü kənardakıları çıxarır', async () => {
      const inside = await http().get('/api/v1/places/map?zoom=14&bbox=47.9,41.1,48.6,41.5').expect(200);
      const slugs = inside.body.items.map((i: { slug: string }) => i.slug);
      expect(slugs).toContain('xinaliq-kendi');
      expect(slugs).not.toContain('icherisheher'); // Bakı bu çərçivədən kənardadır
    });
  });

  describe('places — detal və fotolar', () => {
    it('detalda kateqoriya, faktlar və fotolar var', async () => {
      const res = await http().get('/api/v1/places/xinaliq-kendi').expect(200);
      expect(res.body.name).toBe('Xınalıq kəndi');
      expect(res.body.altitudeM).toBe(2140);
      expect(res.body.categories.length).toBeGreaterThan(0);
      expect(res.body.reviewCount).toBeGreaterThan(0);
    });

    it('foto qalereyasında rəsmi/icma sayları var', async () => {
      const res = await http().get('/api/v1/places/xinaliq-kendi/photos').expect(200);
      expect(res.body.counts.all).toBeGreaterThan(0);
      expect(res.body.data[0].url).toContain('http');
    });

    it('mövcud olmayan məkan üçün 404', async () => {
      await http().get('/api/v1/places/yoxdur').expect(404);
    });
  });

  describe('search', () => {
    it('qarışıq nəticə qaytarır', async () => {
      const res = await http().get('/api/v1/search?q=quba&limit=10').expect(200);
      const types = new Set(res.body.results.map((r: { type: string }) => r.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it('tipə görə məhdudlaşdırır', async () => {
      const res = await http().get('/api/v1/search?q=quba&types=route').expect(200);
      for (const r of res.body.results) expect(r.type).toBe('route');
    });

    it('çox qısa sorğu üçün boş nəticə', async () => {
      const res = await http().get('/api/v1/search?q=ab').expect(200);
      expect(res.body.results).toHaveLength(0);
    });

    it('təkliflərdə region də görünür', async () => {
      const res = await http().get('/api/v1/search/suggest?q=qeb').expect(200);
      expect(res.body.some((s: { type: string }) => s.type === 'region')).toBe(true);
    });

    it('axtarış tarixçəsini yazır və təmizləyir', async () => {
      await http().get('/api/v1/search?q=xinaliq').set('Authorization', `Bearer ${token}`).expect(200);

      const recent = await http().get('/api/v1/search/recent').set('Authorization', `Bearer ${token}`).expect(200);
      expect(recent.body.map((r: { query: string }) => r.query)).toContain('xinaliq');

      await http().delete('/api/v1/search/recent').set('Authorization', `Bearer ${token}`).expect(200);
      const after = await http().get('/api/v1/search/recent').set('Authorization', `Bearer ${token}`).expect(200);
      expect(after.body).toHaveLength(0);
    });
  });

  describe('reviews', () => {
    it('ulduz bölgüsü ilə xülasə verir', async () => {
      const res = await http().get('/api/v1/reviews/summary?targetType=place&target=xinaliq-kendi').expect(200);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.average).toBeGreaterThan(4);
      expect(res.body.breakdown).toHaveLength(5);
      const sum = res.body.breakdown.reduce((n: number, b: { count: number }) => n + b.count, 0);
      expect(sum).toBe(res.body.total);
    });

    it('rəyləri müəllif və fotolarla qaytarır', async () => {
      const res = await http().get('/api/v1/reviews?targetType=place&target=xinaliq-kendi').expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].author).toHaveProperty('username');
      expect(res.body.data.some((r: { photos: unknown[] }) => r.photos.length > 0)).toBe(true);
    });

    it('yalnız fotolu rəyləri filtrləyir', async () => {
      const res = await http()
        .get('/api/v1/reviews?targetType=place&target=xinaliq-kendi&withPhotos=true')
        .expect(200);
      for (const r of res.body.data) expect(r.photos.length).toBeGreaterThan(0);
    });

    it('ulduza görə filtrləyir', async () => {
      const res = await http().get('/api/v1/reviews?targetType=place&target=xinaliq-kendi&rating=4').expect(200);
      for (const r of res.body.data) expect(r.rating).toBe(4);
    });

    it('faydalı işarəsini qoyub götürür', async () => {
      const list = await http().get('/api/v1/reviews?targetType=place&target=xinaliq-kendi&limit=1').expect(200);
      const id = list.body.data[0].publicId;
      const before = list.body.data[0].helpfulCount;

      const marked = await http()
        .post(`/api/v1/reviews/${id}/helpful`).set('Authorization', `Bearer ${token}`).expect(201);
      expect(marked.body.helpfulCount).toBe(before + 1);

      // Təkrar işarələmə sayı artırmır
      const again = await http()
        .post(`/api/v1/reviews/${id}/helpful`).set('Authorization', `Bearer ${token}`).expect(201);
      expect(again.body.helpfulCount).toBe(before + 1);

      const removed = await http()
        .delete(`/api/v1/reviews/${id}/helpful`).set('Authorization', `Bearer ${token}`).expect(200);
      expect(removed.body.helpfulCount).toBe(before);
    });

    it('mövcud olmayan hədəf üçün 404', async () => {
      await http().get('/api/v1/reviews/summary?targetType=place&target=yoxdur').expect(404);
    });
  });
});
