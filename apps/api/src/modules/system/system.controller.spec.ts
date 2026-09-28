import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';

describe('SystemController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health — baza əlçatandır', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database).toBe('up');
  });

  it('GET /config — gamification qaydaları qaytarır', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/config').expect(200);
    expect(res.body.gamification.maxLevel).toBe(20);
    expect(res.body.gamification.tiers).toHaveLength(5);
    expect(res.body.gamification.xpRules.place_checkin.xp).toBe(600);
    expect(res.body.platformCommissionRate).toBe(0.2);
  });

  it('GET /categories — seed edilmiş kateqoriyalar gəlir', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('name.az');
  });

  it('GET /legal/:slug — tapılmayan sənəd üçün NOT_FOUND kodu', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/legal/yoxdur').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('GET /legal/:slug — Accept-Language və ?lang= ilə tərcümə', async () => {
    const az = await request(app.getHttpServer()).get('/api/v1/legal/terms').expect(200);
    expect(az.body.title).toBe('İstifadə şərtləri');
    expect(az.body.url).toMatch(/\/legal\/terms\/page$/);

    const en = await request(app.getHttpServer()).get('/api/v1/legal/terms').set('Accept-Language', 'en').expect(200);
    expect(en.body.title).toBe('Terms of Use');
    expect(en.body.sections).toHaveLength(az.body.sections.length);
    expect(en.body.url).toMatch(/\/legal\/terms\/page\?lang=en$/);

    const page = await request(app.getHttpServer()).get('/api/v1/legal/privacy/page?lang=ru').expect(200);
    expect(page.text).toContain('<html lang="ru">');
    expect(page.text).toContain('Политика конфиденциальности');
  });

  it('xəta mesajı sorğunun dilindədir', async () => {
    const ru = await request(app.getHttpServer()).get('/api/v1/legal/yoxdur').set('Accept-Language', 'ru').expect(404);
    expect(ru.body.message).toBe('Документ не найден: yoxdur');
    const az = await request(app.getHttpServer()).get('/api/v1/legal/yoxdur').expect(404);
    expect(az.body.message).toBe('Sənəd tapılmadı: yoxdur');
  });

  it('POST /feedback — yanlış məlumat VALIDATION_FAILED verir', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/feedback')
      .send({ type: 'yanlis', message: 'qs' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details.length).toBe(2);
  });
});
