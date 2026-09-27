import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { createHmac } from 'node:crypto';
import { AppModule } from '@/app.module';
import { uniqueTag } from '@/common/testing/unique-tag';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EXPERT_PAYOUT_RATE, PLATFORM_COMMISSION_RATE } from '@gezgin/shared';

/** Mock provayderin test kartları. */
const CARDS = {
  success: '4111111111111111',
  declined: '4000000000000002',
  threeDs: '4000000000003220',
  expired: '4000000000000069',
};

describe('Rezervasiya + Ödəniş (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = uniqueTag();
  const email = `book.${tag}@gezgin.test`;

  let token: string;
  let expertToken: string;
  let slotId: number;
  let cardId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      fullName: 'Rezervasiya Testi', username: `book.${tag}`, email, password: 'Sifre12345',
    });
    token = reg.body.accessToken;

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

    // Sınaq üçün təzə slot
    const startAt = new Date(Date.now() + 20 * 86400_000).toISOString();
    await request(app.getHttpServer())
      .post('/api/v1/experiences/kend-metbexi-masterklassi/slots')
      .set({ Authorization: `Bearer ${expertToken}` })
      .send({ startAt: [startAt], capacity: 30 });

    const avail = await request(app.getHttpServer())
      .get('/api/v1/experiences/kend-metbexi-masterklassi/availability?days=60');
    slotId = avail.body.slots.find((s: { startAt: string }) => s.startAt.startsWith(startAt.slice(0, 10)))!.slotId;
  });

  afterAll(async () => {
    for (const e of [email, `oth3.${tag}@gezgin.test`]) {
      const user = await prisma.user.findUnique({ where: { email: e }, select: { id: true } });
      if (!user) continue;
      await prisma.booking.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.experienceSlot.deleteMany({ where: { id: BigInt(slotId) } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const addCard = async (number: string) => {
    const res = await http().post('/api/v1/payments/methods').set(auth())
      .send({ number, expMonth: 12, expYear: 2029, cvv: '123' }).expect(201);
    return res.body.publicId as string;
  };

  const book = (extra: Record<string, unknown> = {}) =>
    http().post('/api/v1/bookings').set(auth()).send({
      type: 'experience', target: 'kend-metbexi-masterklassi', slotId, adults: 1, ...extra,
    });

  describe('qiymət hesabı', () => {
    it('uşaqları 50% endirimlə hesablayır', async () => {
      const res = await http().post('/api/v1/bookings/quote').set(auth())
        .send({ type: 'experience', target: 'kend-metbexi-masterklassi', slotId, adults: 2, children: 1 })
        .expect(201);

      const adult = res.body.lines.find((l: { code: string }) => l.code === 'adult');
      const child = res.body.lines.find((l: { code: string }) => l.code === 'child');
      expect(adult.totalAzn).toBe(120);
      expect(child.unitAzn).toBe(30);
      expect(res.body.totalAzn).toBe(150);
    });

    it('əlavə xidməti nəfər sayına vurur', async () => {
      const res = await http().post('/api/v1/bookings/quote').set(auth())
        .send({ type: 'experience', target: 'kend-metbexi-masterklassi', slotId, adults: 2, children: 1, extras: ['transfer'] })
        .expect(201);
      const transfer = res.body.lines.find((l: { code: string }) => l.code === 'transfer');
      expect(transfer.quantity).toBe(3);
      expect(res.body.totalAzn).toBe(225);
    });

    it('80/20 komissiyasını yalnız əsas məbləğdən hesablayır', async () => {
      const res = await http().post('/api/v1/bookings/quote').set(auth())
        .send({ type: 'experience', target: 'kend-metbexi-masterklassi', slotId, adults: 2, extras: ['transfer'] })
        .expect(201);
      // Əsas 120 AZN → expert 96, platforma 24. Transfer komissiyaya daxil deyil.
      expect(res.body.commission.expertEarnsAzn).toBe(120 * EXPERT_PAYOUT_RATE);
      expect(res.body.commission.rate).toBe(PLATFORM_COMMISSION_RATE);
    });

    it('naməlum əlavə xidməti rədd edir', async () => {
      await http().post('/api/v1/bookings/quote').set(auth())
        .send({ type: 'experience', target: 'kend-metbexi-masterklassi', slotId, extras: ['yoxdur'] })
        .expect(400);
    });

    it('ləğv siyasətini qaytarır', async () => {
      const res = await http().post('/api/v1/bookings/quote').set(auth())
        .send({ type: 'experience', target: 'kend-metbexi-masterklassi', slotId }).expect(201);
      expect(res.body.cancellationPolicy).toHaveLength(3);
      expect(res.body.cancellationPolicy[0].refundPercent).toBe(100);
    });
  });

  describe('ödəniş üsulları', () => {
    it('kartı tokenləşdirir, PAN saxlamır', async () => {
      cardId = await addCard(CARDS.success);
      const stored = await prisma.paymentMethod.findFirst({ where: { publicId: cardId } });
      expect(stored!.providerToken).not.toContain(CARDS.success);
      expect(stored!.last4).toBe('1111');
      expect(stored!.brand).toBe('visa');
    });

    it('ilk kart avtomatik defolt olur', async () => {
      const methods = await http().get('/api/v1/payments/methods').set(auth()).expect(200);
      expect(methods.body[0].isDefault).toBe(true);
    });

    it('başqa kartı əsas edir, əvvəlki əsaslıqdan çıxır', async () => {
      const second = await addCard(CARDS.declined);
      const res = await http().post(`/api/v1/payments/methods/${second}/default`).set(auth()).expect(200);
      const isDefault = Object.fromEntries(
        (res.body as Array<{ publicId: string; isDefault: boolean }>).map((m) => [m.publicId, m.isDefault]),
      );
      expect(isDefault).toMatchObject({ [second]: true, [cardId]: false });

      // Sonrakı testlər ilk kartın əsas olduğunu gözləyir
      await http().post(`/api/v1/payments/methods/${cardId}/default`).set(auth()).expect(200);
      await http().post('/api/v1/payments/methods/01NOTEXISTING000000000000/default').set(auth()).expect(404);
    });

    it('yanlış kart nömrəsini rədd edir', async () => {
      await http().post('/api/v1/payments/methods').set(auth())
        .send({ number: '123', expMonth: 12, expYear: 2029, cvv: '123' }).expect(400);
    });
  });

  describe('rezervasiya axını', () => {
    let bookingId: string;

    it('ödənişlə birlikdə yaradır və təsdiqləyir', async () => {
      const res = await book({ adults: 2, paymentMethod: cardId }).expect(201);
      expect(res.body.status).toBe('confirmed');
      expect(res.body.payment.status).toBe('succeeded');
      expect(res.body.code).toMatch(/^GZ-[0-9A-Z]{6}$/);
      bookingId = res.body.publicId;
    });

    it('komissiya qeydi yaradır', async () => {
      const booking = await prisma.booking.findFirst({ where: { publicId: bookingId }, include: { commission: true } });
      expect(booking!.commission).toBeTruthy();
      expect(Number(booking!.commission!.expertAzn)).toBe(120 * EXPERT_PAYOUT_RATE);
    });

    it('slotdakı yeri azaldır', async () => {
      const res = await http().get('/api/v1/experiences/kend-metbexi-masterklassi/availability?days=60').expect(200);
      const slot = res.body.slots.find((s: { slotId: number }) => s.slotId === slotId);
      expect(slot.seatsLeft).toBe(slot.capacity - 2);
    });

    it('Idempotency-Key ilə təkrar sifariş yaratmır', async () => {
      const first = await http().post('/api/v1/bookings').set(auth())
        .set('Idempotency-Key', `key-${tag}`)
        .send({ type: 'experience', target: 'kend-metbexi-masterklassi', slotId, adults: 1 })
        .expect(201);

      const second = await http().post('/api/v1/bookings').set(auth())
        .set('Idempotency-Key', `key-${tag}`)
        .send({ type: 'experience', target: 'kend-metbexi-masterklassi', slotId, adults: 1 })
        .expect(201);

      expect(second.body.code).toBe(first.body.code);
    });

    it('bileti QR məlumatı ilə verir', async () => {
      const res = await http().get(`/api/v1/bookings/${bookingId}/ticket`).set(auth()).expect(200);
      expect(res.body.qrPayload).toContain('GEZGIN:');
      expect(res.body.code).toBeTruthy();
    });

    it('keçmiş tarixə rezervasiya etmir', async () => {
      const res = await http().post('/api/v1/bookings').set(auth())
        .send({ type: 'experience', target: 'kend-metbexi-masterklassi', startAt: '2020-01-01T09:00:00Z', adults: 1 })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('başqasının rezervasiyasını göstərmir', async () => {
      const other = await http().post('/api/v1/auth/register').send({
        fullName: 'Digər', username: `oth2.${tag}`, email: `oth2.${tag}@gezgin.test`, password: 'Sifre12345',
      });
      await http().get(`/api/v1/bookings/${bookingId}`)
        .set({ Authorization: `Bearer ${other.body.accessToken}` }).expect(403);
      await prisma.user.deleteMany({ where: { email: `oth2.${tag}@gezgin.test` } });
    });
  });

  describe('ödəniş xətaları', () => {
    it('rədd edilən kart rezervasiyanı ödənilməmiş saxlayır', async () => {
      const declined = await addCard(CARDS.declined);
      const booking = await book().expect(201);

      const res = await http().post(`/api/v1/bookings/${booking.body.publicId}/pay`).set(auth())
        .send({ paymentMethod: declined }).expect(400);
      expect(res.body.code).toBe('PAYMENT_FAILED');
      expect(res.body.details.failureCode).toBe('insufficient_funds');

      const after = await http().get(`/api/v1/bookings/${booking.body.publicId}`).set(auth()).expect(200);
      expect(after.body.status).toBe('awaiting_payment');
    });

    it('müddəti bitmiş kartı rədd edir', async () => {
      const expired = await addCard(CARDS.expired);
      const booking = await book().expect(201);
      const res = await http().post(`/api/v1/bookings/${booking.body.publicId}/pay`).set(auth())
        .send({ paymentMethod: expired }).expect(400);
      expect(res.body.details.failureCode).toBe('expired_card');
    });

    it('3-D Secure tələb edir, OTP ilə tamamlanır', async () => {
      const tds = await addCard(CARDS.threeDs);
      const booking = await book().expect(201);

      const pending = await http().post(`/api/v1/bookings/${booking.body.publicId}/pay`).set(auth())
        .send({ paymentMethod: tds }).expect(201);
      expect(pending.body.payment.status).toBe('requires_action');
      expect(pending.body.payment.actionUrl).toContain('mock3ds');

      const done = await http().post(`/api/v1/bookings/${booking.body.publicId}/pay`).set(auth())
        .send({ paymentMethod: tds, otp: '123456' }).expect(201);
      expect(done.body.status).toBe('confirmed');
    });
  });

  describe('ləğv və geri qaytarma', () => {
    it('48 saatdan çox qalıbsa tam geri qaytarır və yeri boşaldır', async () => {
      const booking = await book({ adults: 2, paymentMethod: cardId }).expect(201);
      const before = await http().get('/api/v1/experiences/kend-metbexi-masterklassi/availability?days=60').expect(200);
      const seatsBefore = before.body.slots.find((s: { slotId: number }) => s.slotId === slotId).seatsLeft;

      const res = await http().post(`/api/v1/bookings/${booking.body.publicId}/cancel`).set(auth())
        .send({ reason: 'Test' }).expect(201);

      expect(res.body.policy.refundPercent).toBe(100);
      expect(res.body.refund.refunded).toBe(true);
      expect(res.body.refund.amountAzn).toBe(booking.body.pricing.totalAzn);

      const after = await http().get('/api/v1/experiences/kend-metbexi-masterklassi/availability?days=60').expect(200);
      expect(after.body.slots.find((s: { slotId: number }) => s.slotId === slotId).seatsLeft).toBe(seatsBefore + 2);
    });

    it('ləğv edilmiş rezervasiyanı ikinci dəfə ləğv etmir', async () => {
      const booking = await book({ paymentMethod: cardId }).expect(201);
      await http().post(`/api/v1/bookings/${booking.body.publicId}/cancel`).set(auth()).send({}).expect(201);
      const res = await http().post(`/api/v1/bookings/${booking.body.publicId}/cancel`).set(auth()).send({}).expect(400);
      expect(res.body.code).toBe('CONFLICT');
    });
  });

  describe('həyat dövrü və ödəniş qaydaları', () => {
    // Hamısı eyni IP-dən gəlir — "burst" limiti (20 sorğu/san) dolmasın deyə hər test təzə pəncərədə başlayır
    beforeEach(() => new Promise((resolve) => setTimeout(resolve, 1100)));

    const xpOf = async () => (await prisma.user.findUniqueOrThrow({ where: { email }, select: { xp: true } })).xp;
    const seatsOf = async () =>
      (await prisma.experienceSlot.findUniqueOrThrow({ where: { id: BigInt(slotId) }, select: { booked: true } })).booked;
    const experienceBookingCount = async () =>
      (await prisma.experience.findUniqueOrThrow({ where: { slug: 'kend-metbexi-masterklassi' }, select: { bookingCount: true } }))
        .bookingCount;

    it('geri qaytarma endpointi yalnız admin üçündür', async () => {
      const booking = await book({ paymentMethod: cardId }).expect(201);
      const res = await http().post(`/api/v1/payments/${booking.body.payment.publicId}/refund`).set(auth())
        .send({ amountAzn: 1 }).expect(403);
      expect(res.body.code).toBe('INSUFFICIENT_ROLE');
    });

    it('Idempotency-Key istifadəçiyə aiddir — başqasının eyni açarı öz sifarişini yaradır', async () => {
      const key = `shared-${tag}`;
      const mine = await book().set('Idempotency-Key', key).expect(201);

      const other = await http().post('/api/v1/auth/register').send({
        fullName: 'Digər 3', username: `oth3.${tag}`, email: `oth3.${tag}@gezgin.test`, password: 'Sifre12345',
      });
      const theirs = await http().post('/api/v1/bookings')
        .set({ Authorization: `Bearer ${other.body.accessToken}`, 'Idempotency-Key': key })
        .send({ type: 'experience', target: 'kend-metbexi-masterklassi', slotId, adults: 1 })
        .expect(201);
      expect(theirs.body.publicId).not.toBe(mine.body.publicId);
    });

    it('ləğv edilmiş rezervasiyanı ödəmir', async () => {
      const booking = await book().expect(201);
      await http().post(`/api/v1/bookings/${booking.body.publicId}/cancel`).set(auth()).send({}).expect(201);
      const res = await http().post(`/api/v1/bookings/${booking.body.publicId}/pay`).set(auth())
        .send({ paymentMethod: cardId }).expect(400);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('başlama vaxtı keçmiş rezervasiyanı ödəmir', async () => {
      const booking = await book().expect(201);
      await prisma.booking.update({
        where: { publicId: booking.body.publicId },
        data: { startAt: new Date(Date.now() - 3600_000) },
      });
      const res = await http().post(`/api/v1/bookings/${booking.body.publicId}/pay`).set(auth())
        .send({ paymentMethod: cardId }).expect(400);
      expect(res.body.message).toBe('Başlama vaxtı keçmiş rezervasiya ödənilə bilməz');
      await prisma.booking.update({ where: { publicId: booking.body.publicId }, data: { status: 'cancelled' } });
    });

    it('ödəniş vaxtı (30 dəq) bitmiş rezervasiya ləğv olunur və yer boşalır', async () => {
      const booking = await book({ adults: 2 }).expect(201);
      const held = await seatsOf();
      await prisma.booking.update({
        where: { publicId: booking.body.publicId },
        data: { createdAt: new Date(Date.now() - 31 * 60_000) },
      });

      const res = await http().get(`/api/v1/bookings/${booking.body.publicId}`).set(auth()).expect(200);
      expect(res.body.status).toBe('cancelled');
      const row = await prisma.booking.findUniqueOrThrow({ where: { publicId: booking.body.publicId } });
      expect(row.cancelReason).toBe('payment_timeout');
      expect(await seatsOf()).toBe(held - 2);
    });

    it('bitmiş təcrübə tamamlanır və +800 XP bir dəfə verilir', async () => {
      const booking = await book({ paymentMethod: cardId }).expect(201);
      expect(booking.body.status).toBe('confirmed');
      await prisma.booking.update({
        where: { publicId: booking.body.publicId },
        data: { startAt: new Date(Date.now() - 5 * 3600_000) }, // yarım gün = 4 saat
      });

      const before = await xpOf();
      const past = await http().get('/api/v1/bookings?filter=past').set(auth()).expect(200);
      const done = past.body.data.find((b: { publicId: string }) => b.publicId === booking.body.publicId);
      expect(done.status).toBe('completed');
      expect(await xpOf()).toBe(before + 800);

      await http().get('/api/v1/bookings?filter=past').set(auth()).expect(200);
      expect(await xpOf()).toBe(before + 800);

      const stats = await http().get('/api/v1/me/stats').set(auth()).expect(200);
      expect(stats.body.experiences).toBeGreaterThanOrEqual(1);
    });

    it('slotsuz bronda qrup həddi və eyni vaxta düşən bronların cəmi yoxlanılır', async () => {
      const startAt = new Date(Date.now() + 40 * 86400_000).toISOString();
      const body = { type: 'experience', target: 'kend-metbexi-masterklassi', startAt };

      const tooBig = await http().post('/api/v1/bookings').set(auth()).send({ ...body, adults: 9 }).expect(400);
      expect(tooBig.body.code).toBe('BOOKING_SLOT_TAKEN');

      await http().post('/api/v1/bookings').set(auth()).send({ ...body, adults: 5 }).expect(201);
      const rest = await http().post('/api/v1/bookings').set(auth()).send({ ...body, adults: 4 }).expect(400);
      expect(rest.body.message).toBe('Bu tarixdə yalnız 3 yer qalıb');
      await http().post('/api/v1/bookings').set(auth()).send({ ...body, adults: 2, children: 1 }).expect(201);
    });

    it('açıq sessiya başqa kartladırsa köhnəsi ləğv olunur, yeni kartla ödənilir', async () => {
      const tds = await addCard(CARDS.threeDs);
      const booking = await book().expect(201);
      await http().post(`/api/v1/bookings/${booking.body.publicId}/pay`).set(auth())
        .send({ paymentMethod: tds }).expect(201);

      const done = await http().post(`/api/v1/bookings/${booking.body.publicId}/pay`).set(auth())
        .send({ paymentMethod: cardId }).expect(201);
      expect(done.body.status).toBe('confirmed');

      const payments = await prisma.payment.findMany({
        where: { booking: { publicId: booking.body.publicId } },
        orderBy: { createdAt: 'asc' },
        include: { method: { select: { publicId: true } } },
      });
      expect(payments).toHaveLength(2);
      expect(payments[0]).toMatchObject({ status: 'failed', failureCode: 'method_changed' });
      expect(payments[1].status).toBe('succeeded');
      expect(payments[1].method!.publicId).toBe(cardId);
    });

    it('təsdiqlənmiş rezervasiyanın ləğvi komissiyanı, sayğacı və +50 XP-ni geri alır', async () => {
      const count0 = await experienceBookingCount();
      const xp0 = await xpOf();
      const booking = await book({ paymentMethod: cardId }).expect(201);
      expect(await experienceBookingCount()).toBe(count0 + 1);
      expect(await xpOf()).toBe(xp0 + 50);

      await http().post(`/api/v1/bookings/${booking.body.publicId}/cancel`).set(auth()).send({}).expect(201);

      const row = await prisma.booking.findUniqueOrThrow({
        where: { publicId: booking.body.publicId },
        include: { commission: true },
      });
      expect(row.commission).toBeNull();
      expect(await experienceBookingCount()).toBe(count0);
      expect(await xpOf()).toBe(xp0);
    });

    it('webhook uğurlu ödənişi `pay` ilə eyni yoldan təsdiqləyir', async () => {
      const tds = await addCard(CARDS.threeDs);
      const booking = await book().expect(201);
      await http().post(`/api/v1/bookings/${booking.body.publicId}/pay`).set(auth())
        .send({ paymentMethod: tds }).expect(201);
      const payment = await prisma.payment.findFirstOrThrow({ where: { booking: { publicId: booking.body.publicId } } });

      const count0 = await experienceBookingCount();
      const xp0 = await xpOf();
      const event = { type: 'payment.succeeded', intentId: payment.providerIntentId, paymentId: `mock_pay_${tag}` };
      const signature = createHmac('sha256', 'mock-webhook-secret').update(JSON.stringify(event)).digest('hex');
      await http().post('/api/v1/payments/webhook').set('x-signature', signature).send(event).expect(200);
      // Təkrar bildiriş ikinci dəfə təsdiqləmir
      await http().post('/api/v1/payments/webhook').set('x-signature', signature).send(event).expect(200);

      const row = await prisma.booking.findUniqueOrThrow({
        where: { publicId: booking.body.publicId },
        include: { commission: true },
      });
      expect(row.status).toBe('confirmed');
      expect(row.commission).toBeTruthy();
      expect(await experienceBookingCount()).toBe(count0 + 1);
      expect(await xpOf()).toBe(xp0 + 50);
    });

    it('"Gələcək" sayğacı siyahı ilə eyni şərtlə sayılır', async () => {
      const res = await http().get('/api/v1/bookings?filter=upcoming&limit=50').set(auth()).expect(200);
      expect(res.body.counts.upcoming).toBe(res.body.data.length);
      const past = await http().get('/api/v1/bookings?filter=past&limit=50').set(auth()).expect(200);
      expect(past.body.counts.past).toBe(past.body.data.length);
    });
  });

  describe('otel paketi — ekran 49', () => {
    it('paket qiymətini əlavə ilə hesablayır', async () => {
      const packages = await http().get('/api/v1/businesses/gabala-resort-spa/packages').expect(200);
      const pkg = packages.body[0];
      expect(pkg.priceAzn).toBe(240);

      const startAt = new Date(Date.now() + 25 * 86400_000).toISOString();
      const res = await http().post('/api/v1/bookings').set(auth())
        .send({ type: 'business_package', target: pkg.publicId, startAt, adults: 2, extras: ['spa'], paymentMethod: cardId })
        .expect(201);

      expect(res.body.pricing.totalAzn).toBe(300); // 240 + 60 spa
      expect(res.body.status).toBe('confirmed');
      expect(res.body.endAt).toBeTruthy(); // gecə sayına görə
      expect(res.body.commission).toBeNull(); // otel paketində expert komissiyası yoxdur
    });
  });

  describe('rezervasiyalarım — ekran 53', () => {
    it('filtrlərə görə ayırır və xərci toplayır', async () => {
      const res = await http().get('/api/v1/bookings?filter=upcoming').set(auth()).expect(200);
      expect(res.body.counts.upcoming).toBeGreaterThan(0);
      expect(res.body.counts.cancelled).toBeGreaterThan(0);
      expect(res.body.summary.totalSpentAzn).toBeGreaterThan(0);

      const cancelled = await http().get('/api/v1/bookings?filter=cancelled').set(auth()).expect(200);
      for (const b of cancelled.body.data) expect(['cancelled', 'refunded']).toContain(b.status);
    });
  });

  describe('biznes profili — ekran 22', () => {
    it('paketləri və xidmətləri qaytarır', async () => {
      const res = await http().get('/api/v1/businesses/gabala-resort-spa').expect(200);
      expect(res.body.name).toBe('Gabala Resort & Spa');
      expect(res.body.packages.length).toBeGreaterThan(0);
      expect(res.body.services.length).toBeGreaterThan(0);
      expect(res.body.rating).toBeGreaterThan(0);
    });

    it('siyahını tipə görə filtrləyir', async () => {
      const res = await http().get('/api/v1/businesses?type=otel').expect(200);
      for (const b of res.body.data) expect(b.type).toBe('otel');
    });

    it('mövcud olmayan biznes üçün 404', async () => {
      await http().get('/api/v1/businesses/yoxdur').expect(404);
    });
  });
});
