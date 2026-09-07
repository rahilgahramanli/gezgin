import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '@/app.module';
import { uniqueTag } from '@/common/testing/unique-tag';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('Marşrut + Təcrübə (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = uniqueTag();

  let token: string;       // adi gezgin
  let expertToken: string; // Local Expert (seed: rustem.q)
  let routeSlug: string;
  const createdExperiences: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      fullName: 'Marşrut Testi',
      username: `route.${tag}`,
      email: `route.${tag}@gezgin.test`,
      password: 'Sifre12345',
    });
    token = reg.body.accessToken;

    // Seed Local Expert-inə şifrə veririk ki, expert axınını sınaya bilək
    await prisma.user.update({
      where: { username: 'rustem.q' },
      data: {
        passwordHash: await argon2.hash('Expert12345', {
          type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1, raw: false,
        }),
      },
    });
    const expertLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login').send({ identifier: 'rustem.q', password: 'Expert12345' });
    expertToken = expertLogin.body.accessToken;
  });

  afterAll(async () => {
    if (createdExperiences.length) {
      await prisma.experience.deleteMany({ where: { slug: { in: createdExperiences } } });
    }
    await prisma.route.deleteMany({ where: { author: { email: `route.${tag}@gezgin.test` } } });
    await prisma.user.deleteMany({ where: { email: `route.${tag}@gezgin.test` } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const expertAuth = () => ({ Authorization: `Bearer ${expertToken}` });

  describe('marşrut oxunuşu', () => {
    it('müddət çipinə görə filtrləyir', async () => {
      const res = await http().get('/api/v1/routes?duration=2-3').expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const r of res.body.data) expect(r.days).toBeGreaterThanOrEqual(2);
      for (const r of res.body.data) expect(r.days).toBeLessThanOrEqual(3);
    });

    it('"7+" formatını açıq aralıq kimi başa düşür', async () => {
      const res = await http().get('/api/v1/routes?duration=1').expect(200);
      for (const r of res.body.data) expect(r.days).toBe(1);
    });

    it('çətinliyə görə filtrləyir', async () => {
      const res = await http().get('/api/v1/routes?difficulty=cetin').expect(200);
      for (const r of res.body.data) expect(r.difficulty).toBe('cetin');
    });

    it('detalda dayanacaqlar günlərə bölünür', async () => {
      const res = await http().get('/api/v1/routes/quba-daglar-turu').expect(200);
      expect(res.body.days).toBe(3);
      expect(res.body.itinerary).toHaveLength(3);
      expect(res.body.itinerary[0].stops[0].place.name).toBeTruthy();
      expect(res.body.stopCount).toBeGreaterThan(0);
    });

    it('yanlış müddət formatını rədd edir', async () => {
      await http().get('/api/v1/routes?duration=abc').expect(400);
    });
  });

  describe('marşrut qurucu', () => {
    it('marşrut yaradır — defolt şəxsidir', async () => {
      const res = await http()
        .post('/api/v1/routes').set(auth())
        .send({ title: `Test marşrutu ${tag}`, region: 'quba', days: 2 })
        .expect(201);
      expect(res.body.visibility).toBe('private');
      expect(res.body.isOwner).toBe(true);
      expect(res.body.itinerary).toHaveLength(2);
      routeSlug = res.body.slug;
    });

    it('mövcud olmayan region üçün 404', async () => {
      await http()
        .post('/api/v1/routes').set(auth())
        .send({ title: 'Yanlış region', region: 'yoxdur' })
        .expect(404);
    });

    it('dayanacaq əlavə edir və məsafəni hesablayır', async () => {
      await http().post(`/api/v1/routes/${routeSlug}/stops`).set(auth())
        .send({ place: 'quba-mese-piknik', day: 1, arriveTime: '09:00', durationMin: 120 }).expect(201);
      const res = await http().post(`/api/v1/routes/${routeSlug}/stops`).set(auth())
        .send({ place: 'nohurgol', day: 1, arriveTime: '12:30' }).expect(201);

      expect(res.body.stopCount).toBe(2);
      expect(res.body.distanceKm).toBeGreaterThan(0);
      expect(res.body.itinerary[0].stops.map((s: { order: number }) => s.order)).toEqual([0, 1]);
    });

    it('marşrutda olmayan günə dayanacaq qoymur', async () => {
      const res = await http().post(`/api/v1/routes/${routeSlug}/stops`).set(auth())
        .send({ place: 'laza', day: 9 }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('dayanacaqları sıralayır (unsigned sort_order ilə toqquşmadan)', async () => {
      const before = await http().get(`/api/v1/routes/${routeSlug}`).set(auth()).expect(200);
      const stops = before.body.itinerary[0].stops;
      const [first, second] = stops;

      const res = await http().put(`/api/v1/routes/${routeSlug}/stops/reorder`).set(auth())
        .send({ stops: [{ stopId: first.stopId, day: 1, order: 1 }, { stopId: second.stopId, day: 1, order: 0 }] })
        .expect(200);

      const after = res.body.itinerary[0].stops;
      expect(after[0].place.slug).toBe(second.place.slug);
      expect(after[1].place.slug).toBe(first.place.slug);
    });

    it('dayanacağı silir və sıra boşluğunu bağlayır', async () => {
      const before = await http().get(`/api/v1/routes/${routeSlug}`).set(auth()).expect(200);
      const firstId = before.body.itinerary[0].stops[0].stopId;

      const res = await http().delete(`/api/v1/routes/${routeSlug}/stops/${firstId}`).set(auth()).expect(200);
      expect(res.body.stopCount).toBe(1);
      expect(res.body.itinerary[0].stops[0].order).toBe(0);
    });

    it('şəxsi marşrut anonimə görünmür', async () => {
      await http().get(`/api/v1/routes/${routeSlug}`).expect(404);
      await http().get(`/api/v1/routes/${routeSlug}`).set(auth()).expect(200);
    });

    it('ictimai edildikdə görünür', async () => {
      await http().patch(`/api/v1/routes/${routeSlug}`).set(auth()).send({ isPublic: true }).expect(200);
      const res = await http().get(`/api/v1/routes/${routeSlug}`).expect(200);
      expect(res.body.visibility).toBe('public');
    });

    it('başqasının marşrutunu redaktə etməyə icazə vermir', async () => {
      const res = await http()
        .patch('/api/v1/routes/quba-daglar-turu').set(auth()).send({ title: 'Oğurlanmış' }).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('marşrutu kopyalayır və mənbənin sayğacını artırır', async () => {
      const before = await http().get('/api/v1/routes/quba-daglar-turu').expect(200);

      const copy = await http().post('/api/v1/routes/quba-daglar-turu/copy').set(auth()).expect(201);
      expect(copy.body.isOwner).toBe(true);
      expect(copy.body.visibility).toBe('private');
      expect(copy.body.stopCount).toBe(before.body.stopCount);

      const after = await http().get('/api/v1/routes/quba-daglar-turu').expect(200);
      expect(after.body.copyCount).toBe(before.body.copyCount + 1);
    });

    it('"mine" siyahısında şəxsi marşrutlar da var', async () => {
      const res = await http().get('/api/v1/routes/mine').set(auth()).expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data[0]).toHaveProperty('visibility');
    });
  });

  describe('təcrübə oxunuşu', () => {
    it('qiyməti 80/20 bölür — ekran 17', async () => {
      const res = await http().get('/api/v1/experiences/kend-metbexi-masterklassi').expect(200);
      const p = res.body.pricing;
      expect(p.priceAzn).toBe(60);
      expect(p.expertEarnsAzn).toBe(48);
      expect(p.platformFeeAzn).toBe(12);
      expect(p.expertRate).toBe(0.8);
    });

    it('qiymətə görə artan sıralayır', async () => {
      const res = await http().get('/api/v1/experiences?sort=price_asc').expect(200);
      const prices = res.body.data.map((e: { priceAzn: number }) => e.priceAzn);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });

    it('maksimum qiymətə görə filtrləyir', async () => {
      const res = await http().get('/api/v1/experiences?maxPrice=50').expect(200);
      for (const e of res.body.data) expect(e.priceAzn).toBeLessThanOrEqual(50);
    });

    it('detalda XP mükafatları göstərilir', async () => {
      const res = await http().get('/api/v1/experiences/kend-metbexi-masterklassi').expect(200);
      expect(res.body.gezginRewards.experienceXp).toBe(800);
      expect(res.body.includes.length).toBeGreaterThan(0);
    });

    it('Local Expert profilini qaytarır — ekran 21', async () => {
      const res = await http().get('/api/v1/experts/rustem.q').expect(200);
      expect(res.body.stats.experienceCount).toBeGreaterThan(0);
      expect(res.body.experiences.length).toBeGreaterThan(0);
      expect(res.body.languages).toContain('az');
    });

    it('adi istifadəçi expert profili kimi açılmır', async () => {
      await http().get('/api/v1/experts/aysel.go').expect(404);
    });
  });

  describe('təcrübə yaratma (Local Expert)', () => {
    let slug: string;

    it('adi gezginə icazə vermir', async () => {
      const res = await http().post('/api/v1/experiences').set(auth())
        .send({ title: 'İcazəsiz', region: 'quba', duration: 'half_day', priceAzn: 50 })
        .expect(403);
      expect(res.body.code).toBe('INSUFFICIENT_ROLE');
    });

    it('expert qaralama yaradır', async () => {
      const res = await http().post('/api/v1/experiences').set(expertAuth())
        .send({
          title: `Test təcrübəsi ${tag}`,
          description: 'Sınaq üçün yaradılmış təcrübə təsviri — kifayət qədər uzundur.',
          region: 'quba', duration: 'two_hours', priceAzn: 45,
          includes: ['beledci'], meetingPoint: 'Quba mərkəz',
        })
        .expect(201);
      expect(res.body.status).toBe('draft');
      expect(res.body.pricing.expertEarnsAzn).toBe(36);
      slug = res.body.slug;
      createdExperiences.push(slug);
    });

    it('qaralama ictimai siyahıda görünmür', async () => {
      const res = await http().get('/api/v1/experiences?region=quba&limit=50').expect(200);
      expect(res.body.data.map((e: { slug: string }) => e.slug)).not.toContain(slug);
    });

    it('qaralamanı sahibi görə bilir', async () => {
      const res = await http().get(`/api/v1/experiences/${slug}`).set(expertAuth()).expect(200);
      expect(res.body.isOwner).toBe(true);
      await http().get(`/api/v1/experiences/${slug}`).expect(404);
    });

    it('fotosuz yayımlanmır', async () => {
      const res = await http().post(`/api/v1/experiences/${slug}/publish`).set(expertAuth()).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.details).toContain('ən azı 1 foto');
    });

    it('gələcək tarixlər əlavə edir, keçmişi atır', async () => {
      const future = new Date(Date.now() + 30 * 86400_000).toISOString();
      const res = await http().post(`/api/v1/experiences/${slug}/slots`).set(expertAuth())
        .send({ startAt: [future, '2020-01-01T09:00:00Z'], capacity: 8 })
        .expect(201);
      expect(res.body.created).toBe(1);
      expect(res.body.skipped).toBe(1);
    });

    it('boş yerləri hesablayır', async () => {
      const res = await http().get(`/api/v1/experiences/${slug}/availability`).expect(200);
      expect(res.body.slots.length).toBeGreaterThan(0);
      expect(res.body.slots[0].seatsLeft).toBe(res.body.slots[0].capacity);
      expect(res.body.slots[0].isFull).toBe(false);
    });

    it('başqa expertin təcrübəsini redaktə etməyə icazə vermir', async () => {
      const res = await http().patch('/api/v1/experiences/lahic-misgerlik-tecrubesi').set(expertAuth())
        .send({ priceAzn: 1 }).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
