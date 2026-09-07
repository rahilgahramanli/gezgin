import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { uniqueTag } from '@/common/testing/unique-tag';
import { PrismaService } from '@/common/prisma/prisma.service';
import { XP_RULES, levelForXp, levelProgress, tierForLevel } from '@gezgin/shared';

/** Seed məkanlarının koordinatları — check-in yaxınlıq yoxlaması üçün. */
const COORDS = {
  'xinaliq-kendi': { lat: 41.1897, lng: 48.0169 },
  laza: { lat: 41.2833, lng: 47.9333 },
  lahic: { lat: 40.8494, lng: 48.3839 },
  goygol: { lat: 40.4083, lng: 46.3306 },
} as const;

describe('Gamification + Offline (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = uniqueTag();
  const email = `gam.${tag}@gezgin.test`;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      fullName: 'Gamification Testi', username: `gam.${tag}`, email, password: 'Sifre12345',
    });
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const checkin = (place: keyof typeof COORDS, extra: Record<string, unknown> = {}) =>
    http().post('/api/v1/checkins').set(auth()).send({ place, ...COORDS[place], ...extra });

  describe('level məntiqi (vahid)', () => {
    it('XP-dən leveli düzgün hesablayır', () => {
      expect(levelForXp(0)).toBe(1);
      expect(levelForXp(149)).toBe(1);
      expect(levelForXp(150)).toBe(2);
      expect(levelForXp(5800)).toBe(12);
      expect(levelForXp(999_999)).toBe(20);
    });

    it('tier sərhədləri prezentasiya ilə uyğundur', () => {
      expect(tierForLevel(1).nameAz).toBe('Başlanğıc');
      expect(tierForLevel(12).nameAz).toBe('Kəşf edən'); // ekran 28: Aysel Level 12
      expect(tierForLevel(14).nameAz).toBe('Səyyah');    // ekran 41: Tural Level 14
      expect(tierForLevel(20).nameAz).toBe('Gezgin');    // ekran 30: Əfsanə badge
    });

    it('level daxilində tərəqqini hesablayır', () => {
      const p = levelProgress(6200);
      expect(p.level).toBe(12);
      expect(p.xpInLevel).toBe(400);
      expect(p.xpForLevel).toBe(1100);
      expect(p.xpToNext).toBe(700);
      expect(p.percent).toBe(36);
    });
  });

  describe('check-in', () => {
    it('uzaqdan check-in etməyə icazə vermir', async () => {
      const res = await http().post('/api/v1/checkins').set(auth())
        .send({ place: 'xinaliq-kendi', lat: 40.4093, lng: 49.8671 }) // Bakı
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.details.distanceM).toBeGreaterThan(100_000);
    });

    it('ilk check-in XP verir və Score-u eyni cavabda göstərir', async () => {
      const res = await checkin('xinaliq-kendi').expect(201);

      expect(res.body.isFirstVisit).toBe(true);
      expect(res.body.isFirstInRegion).toBe(true);
      expect(res.body.distanceM).toBeLessThan(100);
      expect(res.body.rewards.xpGained).toBe(XP_RULES.place_checkin.xp);
      // Score check-in yazıldıqdan sonra hesablanır — 0 olmamalıdır
      expect(res.body.rewards.gezginScore).toBeGreaterThan(0);
      expect(res.body.rewards.scoreDelta).toBeGreaterThan(0);
      expect(res.body.rewards.leveledUp).toBe(true);
    });

    it('ilk check-in "İlk Addım" badge-ini eyni cavabda verir', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
      const badge = await prisma.userBadge.findFirst({
        where: { userId: user.id, badge: { slug: 'ilk-addim' }, earnedAt: { not: null } },
      });
      expect(badge).toBeTruthy();
    });

    it('təkrar check-in XP vermir, amma qeydə alınır', async () => {
      const before = await http().get('/api/v1/me/score').set(auth()).expect(200);
      const res = await checkin('xinaliq-kendi').expect(201);

      expect(res.body.isFirstVisit).toBe(false);
      expect(res.body.rewards.xpGained).toBe(0);
      expect(res.body.rewards.tier).toBeTruthy(); // boş string qalmamalıdır
      const after = await http().get('/api/v1/me/score').set(auth()).expect(200);
      expect(after.body.xp).toBe(before.body.xp);
    });

    it('mövqe göndərilməzsə məsafə yoxlanılmır', async () => {
      const res = await http().post('/api/v1/checkins').set(auth())
        .send({ place: 'laza' }).expect(201);
      expect(res.body.distanceM).toBeNull();
      expect(res.body.rewards.xpGained).toBe(XP_RULES.place_checkin.xp);
    });

    it('gündəlik limitə çatanda XP vermir', async () => {
      // place_checkin dailyCap = 3; artıq 2 XP-li check-in var
      const third = await checkin('lahic').expect(201);
      expect(third.body.rewards.xpGained).toBe(XP_RULES.place_checkin.xp);

      const fourth = await checkin('goygol').expect(201);
      expect(fourth.body.rewards.xpGained).toBe(0);
      expect(fourth.body.rewards.cappedByDailyLimit).toBe(true);
      expect(fourth.body.isFirstVisit).toBe(true); // ziyarət yenə qeydə alınır
    });

    it('mövcud olmayan məkan üçün 404', async () => {
      await http().post('/api/v1/checkins').set(auth()).send({ place: 'yoxdur' }).expect(404);
    });

    it('check-in tarixçəsini qaytarır', async () => {
      const res = await http().get('/api/v1/me/checkins').set(auth()).expect(200);
      expect(res.body.data.length).toBeGreaterThan(3);
      expect(res.body.data[0].place.name).toBeTruthy();
    });
  });

  describe('səyahətlə əlaqə', () => {
    it('check-in plandakı elementi tamamlayır', async () => {
      const trip = await http().post('/api/v1/trips').set(auth())
        .send({ title: `Check-in səyahəti ${tag}`, fromRoute: 'quba-daglar-turu', startDate: '2026-07-05' })
        .expect(201);

      const res = await http().post('/api/v1/checkins').set(auth())
        .send({ place: 'laza', trip: trip.body.publicId })
        .expect(201);

      expect(res.body.trip.completedItems).toBe(1);
      expect(res.body.trip.done).toBe(1);
      expect(res.body.trip.percent).toBeGreaterThan(0);
    });

    it('başqasının səyahətinə check-in etmir', async () => {
      const other = await http().post('/api/v1/auth/register').send({
        fullName: 'Digər', username: `oth.${tag}`, email: `oth.${tag}@gezgin.test`, password: 'Sifre12345',
      });
      const trip = await http().post('/api/v1/trips')
        .set({ Authorization: `Bearer ${other.body.accessToken}` })
        .send({ title: 'Yad səyahət' }).expect(201);

      await http().post('/api/v1/checkins').set(auth())
        .send({ place: 'lahic', trip: trip.body.publicId }).expect(404);

      await prisma.user.deleteMany({ where: { email: `oth.${tag}@gezgin.test` } });
    });
  });

  describe('XP digər axınlarda', () => {
    it('marşrut yaradanda +350 XP verir', async () => {
      const before = await http().get('/api/v1/me/score').set(auth()).expect(200);
      const res = await http().post('/api/v1/routes').set(auth())
        .send({ title: `XP marşrutu ${tag}`, region: 'quba' }).expect(201);

      expect(res.body.rewards.xpGained).toBe(XP_RULES.route_created.xp);
      const after = await http().get('/api/v1/me/score').set(auth()).expect(200);
      expect(after.body.xp).toBe(before.body.xp + XP_RULES.route_created.xp);
    });

    it('səyahət tamamlananda +500 XP verir, təkrarında yox', async () => {
      const trip = await http().post('/api/v1/trips').set(auth()).send({ title: 'Bitəcək' }).expect(201);

      const first = await http().post(`/api/v1/trips/${trip.body.publicId}/complete`).set(auth()).expect(201);
      expect(first.body.rewards.xpGained).toBe(XP_RULES.trip_completed.xp);

      const second = await http().post(`/api/v1/trips/${trip.body.publicId}/complete`).set(auth()).expect(201);
      expect(second.body.rewards).toBeNull();
    });
  });

  describe('score və badge-lər', () => {
    it('Score kartında xal qazanma yolları var — ekran 29', async () => {
      const res = await http().get('/api/v1/me/score').set(auth()).expect(200);
      expect(res.body.earnRules.length).toBe(Object.keys(XP_RULES).length);
      const checkinRule = res.body.earnRules.find((r: { action: string }) => r.action === 'place_checkin');
      expect(checkinRule.xp).toBe(600);
      expect(checkinRule.dailyCap).toBe(3);
    });

    it('yeni istifadəçidə trend faizi mənasız dəyər vermir', async () => {
      const fresh = await http().post('/api/v1/auth/register').send({
        fullName: 'Təzə', username: `fresh.${tag}`, email: `fresh.${tag}@gezgin.test`, password: 'Sifre12345',
      });
      const res = await http().get('/api/v1/me/score')
        .set({ Authorization: `Bearer ${fresh.body.accessToken}` }).expect(200);
      expect(res.body.trendPercent).toBeNull();

      await prisma.user.deleteMany({ where: { email: `fresh.${tag}@gezgin.test` } });
    });

    it('badge tərəqqisini faizlə göstərir', async () => {
      const res = await http().get('/api/v1/me/badges').set(auth()).expect(200);
      expect(res.body.totalCount).toBeGreaterThan(0);
      expect(res.body.earnedCount).toBeGreaterThan(0);

      const first = res.body.badges.find((b: { slug: string }) => b.slug === 'ilk-addim');
      expect(first.earned).toBe(true);
      expect(first.percent).toBe(100);

      const legend = res.body.badges.find((b: { slug: string }) => b.slug === 'efsane');
      expect(legend.earned).toBe(false);
      expect(legend.conditionValue).toBe(20);
    });

    it('level nərdivanı 20 level və 5 tier göstərir', async () => {
      const res = await http().get('/api/v1/levels').set(auth()).expect(200);
      expect(res.body.levels).toHaveLength(20);
      expect(res.body.currentLevel).toBeGreaterThan(1);
      expect(new Set(res.body.levels.map((l: { tier: string }) => l.tier)).size).toBe(5);
      expect(res.body.levels[0].reached).toBe(true);
      expect(res.body.levels[19].reached).toBe(false);
    });

    it('XP tarixçəsi hərəkət adları ilə gəlir', async () => {
      const res = await http().get('/api/v1/me/xp').set(auth()).expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name).toBeTruthy();
      expect(res.body.data.some((t: { note: string }) => t.note === 'Gündəlik limit dolub')).toBe(true);
    });
  });

  describe('liderlər cədvəli', () => {
    it('həftəlik siyahıda özümü tapır', async () => {
      const res = await http().get('/api/v1/leaderboard?period=weekly').set(auth()).expect(200);
      expect(res.body.me).toBeTruthy();
      expect(res.body.me.rank).toBeGreaterThan(0);
      expect(res.body.entries.length).toBeGreaterThan(0);
      expect(res.body.podium.length).toBeLessThanOrEqual(3);
    });

    it('bütün zamanlar Gezgin Score-a görə sıralayır', async () => {
      const res = await http().get('/api/v1/leaderboard?period=all_time').expect(200);
      const points = res.body.entries.map((e: { points: number }) => e.points);
      expect(points).toEqual([...points].sort((a, b) => b - a));
    });

    it('anonim baxışda "me" boşdur', async () => {
      const res = await http().get('/api/v1/leaderboard?period=weekly').expect(200);
      expect(res.body.me).toBeNull();
    });
  });

  describe('offline paketlər', () => {
    it('mövcud regionları ölçü təxmini ilə göstərir', async () => {
      const res = await http().get('/api/v1/offline/packages').set(auth()).expect(200);
      expect(res.body.available.length).toBeGreaterThan(0);
      expect(res.body.available[0].sizeMb).toBeGreaterThan(0);
      expect(res.body.storage.quotaMb).toBe(2048);
    });

    it('yükləməni qeydə alır və yaddaşı hesablayır', async () => {
      await http().post('/api/v1/offline/packages/quba/download').set(auth()).expect(201);

      const res = await http().get('/api/v1/offline/packages').set(auth()).expect(200);
      expect(res.body.downloaded.map((d: { region: { slug: string } }) => d.region.slug)).toContain('quba');
      expect(res.body.storage.usedMb).toBeGreaterThan(0);
      expect(res.body.available.map((d: { region: { slug: string } }) => d.region.slug)).not.toContain('quba');
    });

    it('manifest məkan, marşrut və əhatə sərhədi verir', async () => {
      const res = await http().get('/api/v1/offline/packages/quba/manifest').expect(200);
      expect(res.body.places.length).toBeGreaterThan(0);
      expect(res.body.routes.length).toBeGreaterThan(0);
      expect(res.body.bbox.minLat).toBeLessThan(res.body.bbox.maxLat);
      expect(res.body.places[0].lat).toBeTruthy();
    });

    it('yüklənmişi silir', async () => {
      await http().delete('/api/v1/offline/packages/quba').set(auth()).expect(200);
      const res = await http().get('/api/v1/offline/packages').set(auth()).expect(200);
      expect(res.body.storage.downloadedCount).toBe(0);
    });
  });
});
