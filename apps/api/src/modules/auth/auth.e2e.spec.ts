import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { uniqueTag } from '@/common/testing/unique-tag';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('Auth + Me (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Hər işləmədə unikal — dev bazasını çirkləndirmir
  const tag = uniqueTag();
  const email = `test.${tag}@gezgin.test`;
  const username = `test.${tag}`;
  const password = 'Sifre12345';

  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Yalnız bu suite-in yaratdıqları — `contains` başqa suite-in
    // istifadəçisini tuta bilər və o istifadəçinin rezervasiyası varsa
    // (FK RESTRICT) silinmə sınır.
    await prisma.user.deleteMany({
      where: { email: { in: [email, `z.${tag}@gezgin.test`, `social.${tag}@gezgin.test`] } },
    });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('qeydiyyat və giriş', () => {
    it('yeni hesab yaradır və sessiya qaytarır', async () => {
      const res = await http()
        .post('/api/v1/auth/register')
        .send({ fullName: 'Test İstifadəçi', username, email, password })
        .expect(201);

      expect(res.body.user.username).toBe(username);
      expect(res.body.user.level).toBe(1);
      expect(res.body.user.onboardingCompleted).toBe(false);
      expect(res.body.accessToken).toBeTruthy();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('eyni e-mail ilə ikinci dəfə qeydiyyata icazə vermir', async () => {
      const res = await http()
        .post('/api/v1/auth/register')
        .send({ fullName: 'Digər', username: `${username}.2`, email, password })
        .expect(409);
      expect(res.body.code).toBe('EMAIL_TAKEN');
    });

    it('zəif şifrəni rədd edir', async () => {
      const res = await http()
        .post('/api/v1/auth/register')
        .send({ fullName: 'Zəif', username: `${username}.3`, email: `z.${tag}@gezgin.test`, password: '123' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('yanlış şifrə üçün istifadəçinin mövcudluğunu sızdırmır', async () => {
      const wrongPassword = await http()
        .post('/api/v1/auth/login').send({ identifier: username, password: 'yanlis' }).expect(401);
      const noUser = await http()
        .post('/api/v1/auth/login').send({ identifier: 'yoxdur.hech.kim', password: 'yanlis' }).expect(401);
      expect(wrongPassword.body.message).toBe(noUser.body.message);
    });

    it('istifadəçi adı ilə də, e-mail ilə də giriş edir', async () => {
      await http().post('/api/v1/auth/login').send({ identifier: username, password }).expect(200);
      await http().post('/api/v1/auth/login').send({ identifier: email, password }).expect(200);
    });
  });

  describe('token rotasiyası', () => {
    it('refresh yeni cüt verir və köhnəni ləğv edir', async () => {
      const rotated = await http().post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);
      expect(rotated.body.accessToken).toBeTruthy();

      const reused = await http().post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
      expect(reused.body.code).toBe('TOKEN_REUSED');
    });
  });

  describe('OTP', () => {
    it('kod göndərir və təsdiqləyir', async () => {
      const sent = await http()
        .post('/api/v1/auth/otp/send').send({ email, purpose: 'login' }).expect(200);
      expect(sent.body.devCode).toMatch(/^\d{6}$/);

      await http()
        .post('/api/v1/auth/otp/verify')
        .send({ email, code: sent.body.devCode, purpose: 'login' })
        .expect(200);
    });

    it('yanlış kodu qəbul etmir', async () => {
      await http().post('/api/v1/auth/otp/send').send({ email, purpose: 'login' }).expect(200);
      const res = await http()
        .post('/api/v1/auth/otp/verify').send({ email, code: '000000', purpose: 'login' }).expect(400);
      expect(res.body.code).toBe('OTP_INVALID');
    });

    it('mövcud olmayan e-mail üçün şifrə bərpasında istifadəçini sızdırmır', async () => {
      const res = await http()
        .post('/api/v1/auth/password/forgot').send({ email: 'yoxdur@gezgin.test' }).expect(200);
      expect(res.body.sent).toBe(true);
      expect(res.body.devCode).toBeUndefined();
    });
  });

  describe('profil', () => {
    it('tokensiz girişi bloklayır', async () => {
      const res = await http().get('/api/v1/me').expect(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('level tərəqqisi ilə profil qaytarır', async () => {
      const res = await http().get('/api/v1/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(res.body.username).toBe(username);
      expect(res.body.gamification.level).toBe(1);
      expect(res.body.gamification.tier).toBe('Başlanğıc');
      expect(res.body.gamification.xpForLevel).toBe(150);
    });

    it('maraqları təyin edir və onboardingi tamamlayır', async () => {
      const set = await http()
        .put('/api/v1/me/interests')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ slugs: ['tebiet', 'macera'] })
        .expect(200);
      expect(set.body).toHaveLength(2);

      const me = await http().get('/api/v1/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(me.body.onboardingCompleted).toBe(true);
    });

    it('mövcud olmayan kateqoriyanı rədd edir', async () => {
      const res = await http()
        .put('/api/v1/me/interests')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ slugs: ['yoxdur'] })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('profili redaktə edir və region bağlayır', async () => {
      const res = await http()
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ bio: 'Test bio', homeRegionSlug: 'quba' })
        .expect(200);
      expect(res.body.bio).toBe('Test bio');
      expect(res.body.homeRegion.slug).toBe('quba');
    });

    it('tutulmuş istifadəçi adını qəbul etmir', async () => {
      const res = await http()
        .patch('/api/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'aysel.go' })
        .expect(409);
      expect(res.body.code).toBe('USERNAME_TAKEN');
    });
  });

  describe('qonaq rejimi', () => {
    it('baxa bilir, amma yaza bilmir', async () => {
      const guest = await http().post('/api/v1/auth/guest').expect(200);
      const token = guest.body.accessToken;
      expect(guest.body.user.isGuest).toBe(true);

      await http().get('/api/v1/me').set('Authorization', `Bearer ${token}`).expect(200);

      const blocked = await http()
        .put('/api/v1/me/interests')
        .set('Authorization', `Bearer ${token}`)
        .send({ slugs: ['tebiet'] })
        .expect(403);
      expect(blocked.body.code).toBe('FORBIDDEN');

      await prisma.user.deleteMany({ where: { publicId: guest.body.user.publicId } });
    });
  });

  describe('media', () => {
    it('həddi aşan faylı rədd edir', async () => {
      const res = await http()
        .post('/api/v1/media/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ contentType: 'image/jpeg', sizeBytes: 20_000_000, folder: 'post' })
        .expect(400);
      expect(res.body.code).toBe('UPLOAD_TOO_LARGE');
    });

    it('dəstəklənməyən fayl növünü rədd edir', async () => {
      await http()
        .post('/api/v1/media/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ contentType: 'application/zip', sizeBytes: 1000, folder: 'post' })
        .expect(400);
    });

    it('presign qaytarır və yüklənməmiş medianı təsdiqləmir', async () => {
      const presign = await http()
        .post('/api/v1/media/presign')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ contentType: 'image/jpeg', sizeBytes: 5000, folder: 'avatar' })
        .expect(201);
      expect(presign.body.uploadUrl).toContain('X-Amz-Signature');

      const res = await http()
        .post(`/api/v1/media/${presign.body.mediaPublicId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
      expect(res.body.message).toContain('yükləmə tamamlanmayıb');
    });
  });

  describe('sosial giriş (mock)', () => {
    it('yeni hesab yaradır, ikinci dəfə eyni hesaba bağlanır', async () => {
      const socialEmail = `social.${tag}@gezgin.test`;
      const first = await http()
        .post('/api/v1/auth/social/google').send({ token: `mock:${socialEmail}` }).expect(200);
      const second = await http()
        .post('/api/v1/auth/social/apple').send({ token: `mock:${socialEmail}` }).expect(200);
      expect(second.body.user.publicId).toBe(first.body.user.publicId);

      await prisma.user.deleteMany({ where: { email: socialEmail } });
    });

    it('formatı yanlış tokeni rədd edir', async () => {
      await http().post('/api/v1/auth/social/google').send({ token: 'yanlis' }).expect(401);
    });
  });
});
