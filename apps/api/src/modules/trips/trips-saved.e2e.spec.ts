import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { uniqueTag } from '@/common/testing/unique-tag';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('Planım + Saxlanılanlar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = uniqueTag();
  const email = `trip.${tag}@gezgin.test`;

  let token: string;
  let tripId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      fullName: 'Plan Testi', username: `trip.${tag}`, email, password: 'Sifre12345',
    });
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await prisma.trip.deleteMany({ where: { userId: user.id } });
      await prisma.savedItem.deleteMany({ where: { userId: user.id } });
      await prisma.collection.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  describe('səyahət yaratma', () => {
    it('marşrutdan yaradanda dayanacaqları köçürür və tarixləri hesablayır', async () => {
      const res = await http().post('/api/v1/trips').set(auth())
        .send({ title: `Test səyahəti ${tag}`, fromRoute: 'quba-daglar-turu', startDate: '2026-07-05', travelers: 2 })
        .expect(201);

      expect(res.body.fromRoute.slug).toBe('quba-daglar-turu');
      expect(res.body.travelers).toBe(2);
      expect(res.body.progress.total).toBeGreaterThan(0);
      expect(res.body.itinerary).toHaveLength(3);
      // 3 günlük marşrut → bitmə tarixi avtomatik
      expect(res.body.endDate.slice(0, 10)).toBe('2026-07-07');
      expect(res.body.itinerary[0].date.slice(0, 10)).toBe('2026-07-05');
      tripId = res.body.publicId;
    });

    it('sıfırdan yaradanda tarixlərə görə gün açır', async () => {
      const res = await http().post('/api/v1/trips').set(auth())
        .send({ title: 'Sıfırdan', startDate: '2026-08-14', endDate: '2026-08-16' })
        .expect(201);
      expect(res.body.itinerary).toHaveLength(3);
      expect(res.body.progress.total).toBe(0);
    });

    it('bitmə tarixi başlanğıcdan əvvəl ola bilməz', async () => {
      const res = await http().post('/api/v1/trips').set(auth())
        .send({ title: 'Yanlış', startDate: '2026-08-16', endDate: '2026-08-14' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('mövcud olmayan marşrut üçün 404', async () => {
      await http().post('/api/v1/trips').set(auth()).send({ title: 'Yoxdur marşrut', fromRoute: 'yoxdur' }).expect(404);
    });
  });

  describe('plan elementləri', () => {
    it('məkan əlavə edir — ekran 48', async () => {
      const res = await http().post(`/api/v1/trips/${tripId}/items`).set(auth())
        .send({ type: 'place', slug: 'lahic', day: 3, startTime: '15:00', note: 'Misgərlik' })
        .expect(201);

      const day3 = res.body.itinerary.find((d: { day: number }) => d.day === 3);
      const added = day3.items.find((i: { target: { slug: string } }) => i.target.slug === 'lahic');
      expect(added.startTime).toBe('15:00');
      expect(added.note).toBe('Misgərlik');
    });

    it('təcrübə əlavə edir və qiyməti göstərir', async () => {
      const res = await http().post(`/api/v1/trips/${tripId}/items`).set(auth())
        .send({ type: 'experience', slug: 'kend-metbexi-masterklassi', day: 1 })
        .expect(201);
      const exp = res.body.itinerary
        .flatMap((d: { items: unknown[] }) => d.items)
        .find((i: { type: string }) => i.type === 'experience');
      expect(exp.target.priceAzn).toBe(60);
    });

    it('type=custom üçün title tələb edir', async () => {
      const res = await http().post(`/api/v1/trips/${tripId}/items`).set(auth())
        .send({ type: 'custom', day: 1 }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('slug olmadan place əlavə etmir', async () => {
      await http().post(`/api/v1/trips/${tripId}/items`).set(auth())
        .send({ type: 'place', day: 1 }).expect(400);
    });

    it('elementi tamamlandı işarələyir və tərəqqi artır', async () => {
      const before = await http().get(`/api/v1/trips/${tripId}`).set(auth()).expect(200);
      const itemId = before.body.itinerary[0].items[0].itemId;

      const res = await http().patch(`/api/v1/trips/${tripId}/items/${itemId}`).set(auth())
        .send({ isDone: true }).expect(200);

      expect(res.body.progress.done).toBe(before.body.progress.done + 1);
      const item = res.body.itinerary.flatMap((d: { items: { itemId: number; isDone: boolean; doneAt: string }[] }) => d.items)
        .find((i: { itemId: number }) => i.itemId === itemId);
      expect(item.isDone).toBe(true);
      expect(item.doneAt).toBeTruthy();
    });

    it('elementi silir və sıra boşluğunu bağlayır', async () => {
      const before = await http().get(`/api/v1/trips/${tripId}`).set(auth()).expect(200);
      const day1 = before.body.itinerary[0].items;
      const removed = day1[0].itemId;

      const res = await http().delete(`/api/v1/trips/${tripId}/items/${removed}`).set(auth()).expect(200);
      const after = res.body.itinerary[0].items;
      expect(after.length).toBe(day1.length - 1);
      expect(after.map((i: { order: number }) => i.order)).toEqual(after.map((_: unknown, i: number) => i));
    });

    it('xəritə nöqtələrində koordinat olan elementlər var', async () => {
      const res = await http().get(`/api/v1/trips/${tripId}`).set(auth()).expect(200);
      expect(res.body.mapPoints.length).toBeGreaterThan(0);
      for (const p of res.body.mapPoints) {
        expect(typeof p.lat).toBe('number');
        expect(typeof p.lng).toBe('number');
      }
    });
  });

  describe('səyahət vəziyyəti', () => {
    it('başladanda status active olur', async () => {
      const res = await http().post(`/api/v1/trips/${tripId}/start`).set(auth()).expect(201);
      expect(res.body.status).toBe('active');
      expect(res.body.startedAt).toBeTruthy();
    });

    it('yalnız bir səyahət aktiv qala bilər', async () => {
      const second = await http().post('/api/v1/trips').set(auth()).send({ title: 'İkinci' }).expect(201);
      await http().post(`/api/v1/trips/${second.body.publicId}/start`).set(auth()).expect(201);

      const first = await http().get(`/api/v1/trips/${tripId}`).set(auth()).expect(200);
      expect(first.body.status).toBe('planned');
    });

    it('tamamlananı yenidən başlatmır', async () => {
      const t = await http().post('/api/v1/trips').set(auth()).send({ title: 'Bitmiş' }).expect(201);
      await http().post(`/api/v1/trips/${t.body.publicId}/complete`).set(auth()).expect(201);

      const res = await http().post(`/api/v1/trips/${t.body.publicId}/start`).set(auth()).expect(400);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('qeyd əlavə edir', async () => {
      const res = await http().post(`/api/v1/trips/${tripId}/notes`).set(auth())
        .send({ body: 'Yanacaq Qubada doldurulmalıdır' }).expect(201);
      expect(res.body.id).toBeTruthy();

      const trip = await http().get(`/api/v1/trips/${tripId}`).set(auth()).expect(200);
      expect(trip.body.notes[0].body).toContain('Yanacaq');
    });
  });

  describe('gün idarəsi', () => {
    it('gün əlavə edir', async () => {
      const before = await http().get(`/api/v1/trips/${tripId}`).set(auth()).expect(200);
      const res = await http().post(`/api/v1/trips/${tripId}/days`).set(auth())
        .send({ title: 'Əlavə gün' }).expect(201);
      expect(res.body.itinerary.length).toBe(before.body.itinerary.length + 1);
    });

    it('gün siləndə elementlər itmir', async () => {
      const before = await http().get(`/api/v1/trips/${tripId}`).set(auth()).expect(200);
      const totalItems = before.body.progress.total;
      const dayWithItems = before.body.itinerary.find((d: { items: unknown[] }) => d.items.length > 0);

      const res = await http().delete(`/api/v1/trips/${tripId}/days/${dayWithItems.dayId}`).set(auth()).expect(200);
      expect(res.body.progress.total).toBe(totalItems);
    });
  });

  describe('sahiblik', () => {
    it('başqasının səyahətini görmür', async () => {
      const other = await http().post('/api/v1/auth/register').send({
        fullName: 'Digər', username: `other.${tag}`, email: `other.${tag}@gezgin.test`, password: 'Sifre12345',
      });
      const res = await http().get(`/api/v1/trips/${tripId}`)
        .set({ Authorization: `Bearer ${other.body.accessToken}` }).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');

      await prisma.user.deleteMany({ where: { email: `other.${tag}@gezgin.test` } });
    });

    it('tokensiz giriş bağlıdır', async () => {
      await http().get('/api/v1/trips').expect(401);
    });
  });

  describe('saxlanılanlar', () => {
    it('müxtəlif tipləri saxlayır və sayır', async () => {
      for (const [type, target] of [
        ['place', 'xinaliq-kendi'], ['place', 'lahic'],
        ['route', 'quba-daglar-turu'],
        ['experience', 'kend-metbexi-masterklassi'],
        ['event', 'ivanovka-festivali'],
      ] as const) {
        await http().post('/api/v1/saved').set(auth()).send({ type, target }).expect(201);
      }

      const res = await http().get('/api/v1/saved').set(auth()).expect(200);
      expect(res.body.counts.all).toBe(5);
      expect(res.body.counts.place).toBe(2);
      expect(res.body.counts.route).toBe(1);
      expect(res.body.data[0].title).toBeTruthy();
    });

    it('təkrar saxlama dublikat yaratmır', async () => {
      await http().post('/api/v1/saved').set(auth()).send({ type: 'place', target: 'lahic' }).expect(201);
      const res = await http().get('/api/v1/saved').set(auth()).expect(200);
      expect(res.body.counts.all).toBe(5);
    });

    it('tipə görə filtrləyir', async () => {
      const res = await http().get('/api/v1/saved?type=experience').set(auth()).expect(200);
      for (const i of res.body.data) expect(i.type).toBe('experience');
      expect(res.body.data[0].priceAzn).toBe(60);
    });

    it('saxlamanı götürür', async () => {
      await http().delete('/api/v1/saved/place/lahic').set(auth()).expect(200);
      const res = await http().get('/api/v1/saved').set(auth()).expect(200);
      expect(res.body.counts.place).toBe(1);
    });

    it('mövcud olmayan hədəfi saxlamır', async () => {
      await http().post('/api/v1/saved').set(auth()).send({ type: 'place', target: 'yoxdur' }).expect(404);
    });
  });

  describe('kolleksiyalar', () => {
    let collectionId: string;

    it('kolleksiya yaradır', async () => {
      const res = await http().post('/api/v1/collections').set(auth()).send({ name: 'Yay 2026' }).expect(201);
      expect(res.body.itemCount).toBe(0);
      collectionId = res.body.publicId;
    });

    it('eyni adla ikinci kolleksiya yaratmır', async () => {
      const res = await http().post('/api/v1/collections').set(auth()).send({ name: 'Yay 2026' }).expect(400);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('kolleksiyaya element əlavə edir və sayğacı artırır', async () => {
      await http().post('/api/v1/saved').set(auth())
        .send({ type: 'place', target: 'goygol', collection: collectionId }).expect(201);

      const res = await http().get('/api/v1/collections').set(auth()).expect(200);
      const c = res.body.collections.find((x: { publicId: string }) => x.publicId === collectionId);
      expect(c.itemCount).toBe(1);
      expect(res.body.all.itemCount).toBeGreaterThan(c.itemCount);
    });

    it('kolleksiya üzrə filtrləyir', async () => {
      const res = await http().get(`/api/v1/saved?collection=${collectionId}`).set(auth()).expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].slug).toBe('goygol');
    });

    it('kolleksiyanı siləndə saxlanılanlar qalır', async () => {
      const before = await http().get('/api/v1/saved').set(auth()).expect(200);
      await http().delete(`/api/v1/collections/${collectionId}`).set(auth()).expect(200);

      const after = await http().get('/api/v1/saved').set(auth()).expect(200);
      expect(after.body.counts.all).toBe(before.body.counts.all);
    });
  });
});
