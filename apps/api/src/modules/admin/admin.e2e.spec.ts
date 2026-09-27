import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { uniqueTag } from '@/common/testing/unique-tag';
import { PrismaService } from '@/common/prisma/prisma.service';

interface TestUser {
  username: string;
  email: string;
  token: string;
  id: bigint;
}

type Key = 'admin' | 'author' | 'reporter';

describe('Admin paneli — moderasiya minimumu (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = uniqueTag();
  const u = {} as Record<Key, TestUser>;
  let postId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    for (const key of ['admin', 'author', 'reporter'] as const) {
      const username = `adm${key}.${tag}`;
      const email = `adm${key}.${tag}@gezgin.test`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ fullName: `Admin ${key} Testi`, username, email, password: 'Sifre12345' })
        .expect(201);
      const row = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
      u[key] = { username, email, token: res.body.accessToken, id: row.id };
    }

    // Rol birbaşa bazada verilir — admin təyinatı üçün endpoint yoxdur (və olmamalıdır)
    await prisma.user.update({ where: { id: u.admin.id }, data: { role: 'admin' } });
    const fresh = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: u.admin.username, password: 'Sifre12345' })
      .expect(200);
    u.admin.token = fresh.body.accessToken;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: u.admin.id } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(u).map((x) => x.email) } } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const as = (key: Key) => ({ Authorization: `Bearer ${u[key].token}` });

  /** Şikayət olunmuş paylaşım — hər test öz növbəsini qurur. */
  async function reportedPost(body = 'Moderasiya testi'): Promise<{ post: string; report: string }> {
    const post = await http().post('/api/v1/posts').set(as('author')).send({ body }).expect(201);
    const report = await http()
      .post(`/api/v1/posts/${post.body.publicId}/report`)
      .set(as('reporter'))
      .send({ reason: 'spam', details: 'Təkrarlanan reklam' })
      .expect(201);
    return { post: post.body.publicId, report: report.body.publicId };
  }

  describe('giriş nəzarəti', () => {
    it('adi istifadəçi admin endpointlərinə çata bilmir', async () => {
      const res = await http().get('/api/v1/admin/reports').set(as('author')).expect(403);
      expect(res.body.code).toBe('INSUFFICIENT_ROLE');
    });

    it('tokensiz sorğu 401 qaytarır', async () => {
      await http().get('/api/v1/admin/stats').expect(401);
    });

    it('admin rolu bütün panelə çıxış verir', async () => {
      const res = await http().get('/api/v1/admin/stats').set(as('admin')).expect(200);
      expect(res.body.reports).toHaveProperty('open');
      expect(res.body.users).toHaveProperty('suspended');
    });
  });

  describe('moderasiya növbəsi', () => {
    it('şikayət növbədə kontent önizləməsi ilə görünür', async () => {
      const { post, report } = await reportedPost('Növbə önizləməsi testi');
      postId = post;

      const res = await http().get('/api/v1/admin/reports?status=open&limit=50').set(as('admin')).expect(200);
      const row = res.body.data.find((r: { publicId: string }) => r.publicId === report);

      expect(row).toBeDefined();
      expect(row.reason).toBe('spam');
      expect(row.reporter.username).toBe(u.reporter.username);
      expect(row.reportedUser.username).toBe(u.author.username);
      // Moderator kontenti görmədən qərar verməməlidir
      expect(row.target.text).toBe('Növbə önizləməsi testi');
      expect(row.target.publicId).toBe(post);
      expect(row.ageHours).toBeGreaterThanOrEqual(0);
    });

    it('detalda tam mətn və müəllif tarixçəsi var', async () => {
      const { report } = await reportedPost('Detal testi');
      const res = await http().get(`/api/v1/admin/reports/${report}`).set(as('admin')).expect(200);

      expect(res.body.target.text).toBe('Detal testi');
      expect(res.body.reportedUser.resolvedReportCount).toBeGreaterThanOrEqual(0);
      expect(res.body.otherReportCount).toBeGreaterThanOrEqual(0);
    });

    it('`dismiss` kontenti toxunulmaz saxlayır, şikayəti rədd edir', async () => {
      const { post, report } = await reportedPost('Əsassız şikayət');
      const res = await http()
        .post(`/api/v1/admin/reports/${report}/resolve`)
        .set(as('admin'))
        .send({ action: 'dismiss', note: 'Qayda pozuntusu görünmür' })
        .expect(201);

      expect(res.body).toMatchObject({ resolved: true, status: 'rejected', contentDeleted: false });
      await http().get(`/api/v1/posts/${post}`).expect(200);
    });

    it('`delete_content` paylaşımı gizlədir və şikayəti bağlayır', async () => {
      const { post, report } = await reportedPost('Silinəcək kontent');
      const res = await http()
        .post(`/api/v1/admin/reports/${report}/resolve`)
        .set(as('admin'))
        .send({ action: 'delete_content' })
        .expect(201);

      expect(res.body).toMatchObject({ resolved: true, status: 'resolved', contentDeleted: true });
      await http().get(`/api/v1/posts/${post}`).expect(404);
    });

    it('`suspend_user` həm kontenti silir, həm hesabı dayandırır', async () => {
      const { post, report } = await reportedPost('Dayandırma testi');
      const res = await http()
        .post(`/api/v1/admin/reports/${report}/resolve`)
        .set(as('admin'))
        .send({ action: 'suspend_user', note: 'Təkrar pozuntu' })
        .expect(201);

      expect(res.body).toMatchObject({ contentDeleted: true, userSuspended: true });
      await http().get(`/api/v1/posts/${post}`).expect(404);

      // Birbaşa dayandırma ilə eyni: sessiyalar bağlanır, audit izi yazılır
      expect(await prisma.refreshToken.count({ where: { userId: u.author.id, revokedAt: null } })).toBe(0);
      const audit = await prisma.auditLog.findFirst({
        where: { actorId: u.admin.id, action: 'user.suspend', targetId: u.author.id },
      });
      expect(audit).toBeTruthy();

      // Dayandırılmış istifadəçinin mövcud tokeni də dərhal etibarsızdır
      await http().get('/api/v1/me').set(as('author')).expect(401);
      await prisma.user.update({ where: { id: u.author.id }, data: { status: 'active' } });
      const back = await http()
        .post('/api/v1/auth/login')
        .send({ identifier: u.author.username, password: 'Sifre12345' })
        .expect(200);
      u.author.token = back.body.accessToken;
    });

    it('`suspend_user` admini dayandırmır və heç nəyə toxunmur', async () => {
      const post = await http().post('/api/v1/posts').set(as('admin')).send({ body: 'Admin paylaşımı' }).expect(201);
      const report = await http()
        .post(`/api/v1/posts/${post.body.publicId}/report`)
        .set(as('reporter'))
        .send({ reason: 'spam' })
        .expect(201);

      const res = await http()
        .post(`/api/v1/admin/reports/${report.body.publicId}/resolve`)
        .set(as('admin'))
        .send({ action: 'suspend_user' })
        .expect(400);
      expect(res.body.code).toBe('FORBIDDEN');

      await http().get(`/api/v1/posts/${post.body.publicId}`).expect(200);
      const detail = await http().get(`/api/v1/admin/reports/${report.body.publicId}`).set(as('admin')).expect(200);
      expect(detail.body.status).toBe('open');
      await http().get('/api/v1/me').set(as('admin')).expect(200);
    });

    it('bağlanmış şikayət ikinci dəfə həll edilmir', async () => {
      const { report } = await reportedPost('Təkrar qərar');
      await http().post(`/api/v1/admin/reports/${report}/resolve`).set(as('admin')).send({ action: 'dismiss' }).expect(201);
      const res = await http()
        .post(`/api/v1/admin/reports/${report}/resolve`)
        .set(as('admin'))
        .send({ action: 'dismiss' })
        .expect(400);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('eyni kontentə olan digər açıq şikayətlər də bağlanır', async () => {
      const post = await http().post('/api/v1/posts').set(as('author')).send({ body: 'İki şikayət' }).expect(201);
      const first = await http()
        .post(`/api/v1/posts/${post.body.publicId}/report`)
        .set(as('reporter'))
        .send({ reason: 'spam' })
        .expect(201);
      const second = await http()
        .post(`/api/v1/posts/${post.body.publicId}/report`)
        .set(as('admin'))
        .send({ reason: 'harassment' })
        .expect(201);

      const res = await http()
        .post(`/api/v1/admin/reports/${first.body.publicId}/resolve`)
        .set(as('admin'))
        .send({ action: 'delete_content' })
        .expect(201);

      expect(res.body.alsoClosed).toBeGreaterThanOrEqual(1);
      const detail = await http().get(`/api/v1/admin/reports/${second.body.publicId}`).set(as('admin')).expect(200);
      expect(detail.body.status).toBe('resolved');
    });
  });

  describe('istifadəçi idarəsi', () => {
    it('axtarış username və ad üzrə tapır', async () => {
      const res = await http().get(`/api/v1/admin/users?q=${u.reporter.username}`).set(as('admin')).expect(200);
      expect(res.body.data[0].username).toBe(u.reporter.username);
      expect(res.body.data[0]).toHaveProperty('reportCount');
    });

    it('istifadəçi kartında sayğaclar və son şikayətlər var', async () => {
      const res = await http().get(`/api/v1/admin/users/${u.author.username}`).set(as('admin')).expect(200);
      expect(res.body.counts).toHaveProperty('posts');
      expect(Array.isArray(res.body.recentReports)).toBe(true);
    });

    it('dayandır → bərpa et dövrəsi işləyir', async () => {
      await http()
        .post(`/api/v1/admin/users/${u.reporter.username}/suspend`)
        .set(as('admin'))
        .send({ reason: 'Spam dalğası' })
        .expect(201);

      await http().get('/api/v1/me').set(as('reporter')).expect(401);

      const again = await http()
        .post(`/api/v1/admin/users/${u.reporter.username}/suspend`)
        .set(as('admin'))
        .send({ reason: 'Təkrar' })
        .expect(400);
      expect(again.body.code).toBe('CONFLICT');

      await http().post(`/api/v1/admin/users/${u.reporter.username}/restore`).set(as('admin')).expect(201);
      const back = await http()
        .post('/api/v1/auth/login')
        .send({ identifier: u.reporter.username, password: 'Sifre12345' })
        .expect(200);
      u.reporter.token = back.body.accessToken;
    });

    it('admin hesabı dayandırıla bilmir', async () => {
      const res = await http()
        .post(`/api/v1/admin/users/${u.admin.username}/suspend`)
        .set(as('admin'))
        .send({ reason: 'Səhv toxunuş' })
        .expect(400);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('kontent silmə və audit izi', () => {
    it('şərh silinəndə paylaşımın sayğacı azalır', async () => {
      const post = await http().post('/api/v1/posts').set(as('author')).send({ body: 'Şərh testi' }).expect(201);
      const comment = await http()
        .post(`/api/v1/posts/${post.body.publicId}/comments`)
        .set(as('reporter'))
        .send({ body: 'Qaydaya zidd şərh' })
        .expect(201);

      await http().delete(`/api/v1/admin/content/comment/${comment.body.publicId}`).set(as('admin')).expect(200);

      const after = await http().get(`/api/v1/posts/${post.body.publicId}`).expect(200);
      expect(after.body.counts.comments).toBe(0);
    });

    it('silinmiş kontent ikinci dəfə silinmir', async () => {
      const post = await http().post('/api/v1/posts').set(as('author')).send({ body: 'İkiqat silmə' }).expect(201);
      await http().delete(`/api/v1/admin/content/post/${post.body.publicId}`).set(as('admin')).expect(200);
      const res = await http().delete(`/api/v1/admin/content/post/${post.body.publicId}`).set(as('admin')).expect(400);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('hər admin əməliyyatı audit izinə düşür', async () => {
      const res = await http().get(`/api/v1/admin/audit?actor=${u.admin.username}&limit=100`).set(as('admin')).expect(200);
      const actions = res.body.data.map((r: { action: string }) => r.action);

      expect(actions).toContain('report.delete_content');
      expect(actions).toContain('user.suspend');
      expect(actions).toContain('content.delete');
      // İz "kim, nəyi, hansı vəziyyətdən" suallarına cavab verir
      const suspend = res.body.data.find((r: { action: string }) => r.action === 'user.suspend');
      expect(suspend.actor).toBe(u.admin.username);
      expect(suspend.after).toMatchObject({ status: 'suspended' });
      expect(suspend.before).toMatchObject({ status: 'active' });
    });
  });
});
