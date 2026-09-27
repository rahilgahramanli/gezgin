import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { ulid } from 'ulid';
import { XP_RULES } from '@gezgin/shared';
import { AppModule } from '@/app.module';
import { uniqueTag } from '@/common/testing/unique-tag';
import { PrismaService } from '@/common/prisma/prisma.service';

interface TestUser {
  username: string;
  email: string;
  token: string;
  id: bigint;
}

type Key = 'a' | 'b' | 'c';

/** Socket hadisəsini gözləyir — gəlməsə testi aydın xəta ilə yıxır. */
function waitFor<T = unknown>(socket: Socket, event: string, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`"${event}" hadisəsi ${timeoutMs} ms-də gəlmədi`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

const XINALIQ = { lat: 41.1897, lng: 48.0169 };
const LENKERAN = { lat: 38.7536, lng: 48.8511 };

describe('Sosial lent — Sprint 7 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  const tag = uniqueTag();
  const u = {} as Record<Key, TestUser>;
  const mediaIds: string[] = [];
  const conversations: string[] = [];
  const sockets: Socket[] = [];
  let publicPost: string;
  let followersPost: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    // Socket testləri real port tələb edir — digər suite-lər yalnız `init` edir
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${port}`;
    prisma = app.get(PrismaService);

    for (const key of ['a', 'b', 'c'] as const) {
      const username = `soc${key}.${tag}`;
      const email = `soc${key}.${tag}@gezgin.test`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ fullName: `Sosial ${key.toUpperCase()} Testi`, username, email, password: 'Sifre12345' })
        .expect(201);
      const row = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
      u[key] = { username, email, token: res.body.accessToken, id: row.id };
    }

    // Media birbaşa bazaya — presign → S3 → complete axını Sprint 1 testlərində yoxlanılıb
    for (const file of ['place-xinaliq.jpg', 'post-aysel-village.jpg', 'valley-vertical.jpg']) {
      const media = await prisma.mediaAsset.create({
        data: {
          publicId: ulid(),
          ownerId: u.a.id,
          type: 'image',
          status: 'ready',
          storageKey: `seed/${file}`,
          mimeType: 'image/jpeg',
        },
      });
      mediaIds.push(media.publicId);
    }
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await prisma.conversation.deleteMany({ where: { publicId: { in: conversations } } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(u).map((x) => x.email) } } });
    await prisma.mediaAsset.deleteMany({ where: { publicId: { in: mediaIds } } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const as = (key: Key) => ({ Authorization: `Bearer ${u[key].token}` });
  const ids = (body: { data: Array<{ publicId: string }> }) => body.data.map((p) => p.publicId);

  describe('paylaşım yaratma — ekran 26', () => {
    it('foto + məkan + heşteq ilə paylaşım +300 XP verir', async () => {
      const res = await http()
        .post('/api/v1/posts')
        .set(as('a'))
        .send({ body: 'Unudulmaz gün! #Gezgin #Xınalıq #gezgin', media: [mediaIds[0], mediaIds[1]], place: 'xinaliq-kendi' })
        .expect(201);

      expect(res.body.media).toHaveLength(2);
      // Karusel sırası göndərildiyi kimi qalır
      expect(res.body.media[0].url).toContain('place-xinaliq.jpg');
      expect(res.body.hashtags).toEqual(['gezgin', 'xınalıq']);
      expect(res.body.place.slug).toBe('xinaliq-kendi');
      expect(res.body.location).toBe('Quba, Azərbaycan');
      expect(res.body.viewer.isMine).toBe(true);
      expect(res.body.rewards.xpGained).toBe(XP_RULES.media_shared.xp);
      publicPost = res.body.publicId;
    });

    it('mətn paylaşımı XP vermir', async () => {
      const res = await http()
        .post('/api/v1/posts')
        .set(as('a'))
        .send({ body: 'Yalnız izləyicilər üçün', visibility: 'followers' })
        .expect(201);
      expect(res.body.rewards).toBeNull();
      followersPost = res.body.publicId;
    });

    it('boş paylaşım rədd edilir', () => http().post('/api/v1/posts').set(as('a')).send({}).expect(400));

    it('başqasının mediası ilə paylaşmaq olmaz', async () => {
      const res = await http().post('/api/v1/posts').set(as('b')).send({ media: [mediaIds[2]] }).expect(400);
      expect(res.body.message).toContain(mediaIds[2]);
    });
  });

  describe('görünürlük və lent — ekran 05', () => {
    it('anonim ictimai paylaşımı görür, izləyici paylaşımını görmür', async () => {
      await http().get(`/api/v1/posts/${publicPost}`).expect(200);
      await http().get(`/api/v1/posts/${followersPost}`).expect(404);
    });

    it('izləyəndən sonra izləyici paylaşımı açılır', async () => {
      await http().get(`/api/v1/posts/${followersPost}`).set(as('b')).expect(404);
      await http().post(`/api/v1/users/${u.a.username}/follow`).set(as('b')).expect(201);
      const res = await http().get(`/api/v1/posts/${followersPost}`).set(as('b')).expect(200);
      expect(res.body.viewer.followsAuthor).toBe(true);
    });

    it('For you yad adama izləyici paylaşımını göstərmir', async () => {
      const res = await http().get('/api/v1/feed?limit=50').set(as('c')).expect(200);
      expect(ids(res.body)).toContain(publicPost);
      expect(ids(res.body)).not.toContain(followersPost);
    });

    it('Following izlənənlərin hər iki paylaşımını göstərir', async () => {
      const res = await http().get('/api/v1/feed?tab=following&limit=50').set(as('b')).expect(200);
      expect(ids(res.body)).toEqual(expect.arrayContaining([publicPost, followersPost]));
    });

    it('Following anonim üçün boşdur', async () => {
      const res = await http().get('/api/v1/feed?tab=following').expect(200);
      expect(res.body.data).toEqual([]);
    });

    it('Nearby məsafəyə görə süzür və məsafəni qaytarır', async () => {
      const near = await http()
        .get(`/api/v1/feed?tab=nearby&lat=${XINALIQ.lat}&lng=${XINALIQ.lng}&radiusKm=5&limit=50`)
        .expect(200);
      const mine = near.body.data.find((p: { publicId: string }) => p.publicId === publicPost);
      expect(mine).toBeDefined();
      expect(mine.distanceKm).toBeLessThan(1);

      const far = await http()
        .get(`/api/v1/feed?tab=nearby&lat=${LENKERAN.lat}&lng=${LENKERAN.lng}&radiusKm=5&limit=50`)
        .expect(200);
      expect(ids(far.body)).not.toContain(publicPost);
    });

    it('Nearby koordinatsız 400', () => http().get('/api/v1/feed?tab=nearby').expect(400));

    it('cursor ilə səhifələmə təkrarsızdır', async () => {
      const first = await http().get(`/api/v1/users/${u.a.username}/posts?limit=1`).set(as('b')).expect(200);
      expect(first.body.data).toHaveLength(1);
      expect(first.body.nextCursor).toBeTruthy();

      const second = await http()
        .get(`/api/v1/users/${u.a.username}/posts?limit=1&cursor=${first.body.nextCursor}`)
        .set(as('b'))
        .expect(200);
      expect(second.body.data).toHaveLength(1);
      expect(second.body.data[0].publicId).not.toBe(first.body.data[0].publicId);
      expect(second.body.nextCursor).toBeNull();
    });
  });

  describe('bəyənmə və şərh — ekran 06', () => {
    it('bəyən → geri al → bəyən: sayğac 1, bildiriş 1', async () => {
      await http().post(`/api/v1/posts/${publicPost}/like`).set(as('b')).expect(201);
      const again = await http().post(`/api/v1/posts/${publicPost}/like`).set(as('b')).expect(201);
      expect(again.body).toEqual({ liked: true, likeCount: 1 });

      const unliked = await http().delete(`/api/v1/posts/${publicPost}/like`).set(as('b')).expect(200);
      expect(unliked.body).toEqual({ liked: false, likeCount: 0 });
      await http().post(`/api/v1/posts/${publicPost}/like`).set(as('b')).expect(201);

      const count = await prisma.notification.count({ where: { userId: u.a.id, type: 'social_like' } });
      expect(count).toBe(1);
    });

    let rootComment: string;

    it('cavaba cavab kök şərhin altına düşür', async () => {
      const root = await http()
        .post(`/api/v1/posts/${publicPost}/comments`)
        .set(as('b'))
        .send({ body: 'Möhtəşəm mənzərə!' })
        .expect(201);
      rootComment = root.body.publicId;

      const reply = await http()
        .post(`/api/v1/posts/${publicPost}/comments`)
        .set(as('c'))
        .send({ body: 'Razıyam', parent: rootComment })
        .expect(201);
      const nested = await http()
        .post(`/api/v1/posts/${publicPost}/comments`)
        .set(as('a'))
        .send({ body: 'Təşəkkürlər 🙂', parent: reply.body.publicId })
        .expect(201);
      expect(nested.body.commentCount).toBe(3);

      const list = await http().get(`/api/v1/posts/${publicPost}/comments`).set(as('a')).expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].replies.map((r: { body: string }) => r.body)).toEqual(['Razıyam', 'Təşəkkürlər 🙂']);
      // Paylaşım sahibi hər şərhi silə bilər
      expect(list.body.data[0].replies[0].canDelete).toBe(true);
    });

    it('şərh bildirişləri doğru ünvana gedir', async () => {
      const count = (id: bigint) => prisma.notification.count({ where: { userId: id, type: 'social_comment' } });
      // A: B-nin şərhi + C-nin cavabı (A-nın öz cavabı özünə getmir)
      expect(await count(u.a.id)).toBe(2);
      // B: C onun şərhinə cavab yazdı
      expect(await count(u.b.id)).toBe(1);
      // C: A onun cavabına cavab yazdı
      expect(await count(u.c.id)).toBe(1);
    });

    it('şərhi bəyənmək', async () => {
      await http().post(`/api/v1/comments/${rootComment}/like`).set(as('c')).expect(201);
      const res = await http().post(`/api/v1/comments/${rootComment}/like`).set(as('c')).expect(201);
      expect(res.body).toEqual({ liked: true, likeCount: 1 });
    });

    it('yad adam şərhi silə bilməz; kök silinəndə cavablar da gedir', async () => {
      await http().delete(`/api/v1/comments/${rootComment}`).set(as('c')).expect(403);
      const res = await http().delete(`/api/v1/comments/${rootComment}`).set(as('a')).expect(200);
      expect(res.body).toMatchObject({ deleted: true, removed: 3, commentCount: 0 });
    });
  });

  describe('istifadəçilər — ekran 41, 42', () => {
    it('profil statistikası və baxanın vəziyyəti', async () => {
      const res = await http().get(`/api/v1/users/${u.a.username}`).set(as('b')).expect(200);
      expect(res.body.stats).toMatchObject({ posts: 2, followers: 1, following: 0 });
      expect(res.body.viewer).toMatchObject({ isMe: false, isFollowing: true, followsYou: false, canMessage: true });
      expect(res.body.canViewContent).toBe(true);
    });

    it('izləyici siyahısı baxanın öz vəziyyətini göstərir', async () => {
      const res = await http().get(`/api/v1/users/${u.a.username}/followers`).set(as('c')).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0]).toMatchObject({ username: u.b.username, isFollowing: false, isMe: false });
    });

    it('özünü izləmək olmaz; izləmə bildirişi bir dəfədir', async () => {
      await http().post(`/api/v1/users/${u.a.username}/follow`).set(as('a')).expect(400);
      await http().post(`/api/v1/users/${u.a.username}/follow`).set(as('b')).expect(201);
      expect(await prisma.notification.count({ where: { userId: u.a.id, type: 'social_follow' } })).toBe(1);
    });

    it('tövsiyələrdə özü və izlədikləri yoxdur', async () => {
      const res = await http().get('/api/v1/users/suggested').set(as('b')).expect(200);
      const names = res.body.data.map((x: { username: string }) => x.username);
      expect(names).not.toContain(u.b.username);
      expect(names).not.toContain(u.a.username);
    });

    it('qapalı hesabın kontenti yalnız izləyiciyə açıqdır', async () => {
      await http().patch('/api/v1/me').set(as('a')).send({ isPublic: false }).expect(200);
      try {
        const profile = await http().get(`/api/v1/users/${u.a.username}`).set(as('c')).expect(200);
        expect(profile.body.canViewContent).toBe(false);

        const posts = await http().get(`/api/v1/users/${u.a.username}/posts`).set(as('c')).expect(200);
        expect(posts.body.data).toHaveLength(0);

        const followers = await http().get(`/api/v1/users/${u.a.username}/followers`).set(as('c')).expect(200);
        expect(followers.body).toMatchObject({ data: [], total: 1 });

        const forFollower = await http().get(`/api/v1/users/${u.a.username}/posts`).set(as('b')).expect(200);
        expect(forFollower.body.data).toHaveLength(2);
      } finally {
        await http().patch('/api/v1/me').set(as('a')).send({ isPublic: true }).expect(200);
      }
    });
  });

  describe('hekayələr — ekran 05, 40', () => {
    let story: string;
    const ringOf = async (key: Key) => {
      const res = await http().get('/api/v1/stories').set(as(key)).expect(200);
      return res.body.data.find((r: { user: { username: string } }) => r.user.username === u.a.username);
    };

    it('yeni hekayə baxılmamış dairə kimi görünür', async () => {
      const created = await http()
        .post('/api/v1/stories')
        .set(as('a'))
        .send({ media: mediaIds[2], caption: 'Zirvədə gün doğuşu ☀️', place: 'laza' })
        .expect(201);
      story = created.body.publicId;
      expect(await ringOf('b')).toMatchObject({ storyCount: 1, hasUnseen: true, isMine: false });
    });

    it('baxış bir dəfə sayılır, sayı yalnız müəllifə görünür', async () => {
      await http().post(`/api/v1/stories/${story}/view`).set(as('b')).expect(201);
      await http().post(`/api/v1/stories/${story}/view`).set(as('b')).expect(201);
      expect((await ringOf('b')).hasUnseen).toBe(false);

      const own = await http().get(`/api/v1/stories/${u.a.username}`).set(as('a')).expect(200);
      expect(own.body.data[0]).toMatchObject({ viewCount: 1, caption: 'Zirvədə gün doğuşu ☀️' });
      expect(own.body.data[0].place.slug).toBe('laza');

      const other = await http().get(`/api/v1/stories/${u.a.username}`).set(as('b')).expect(200);
      expect(other.body.data[0]).not.toHaveProperty('viewCount');
      expect(other.body.data[0].viewed).toBe(true);
    });

    it('qapalı hesabın hekayəsinə izləməyən "baxa" bilmir', async () => {
      await http().patch('/api/v1/me').set(as('a')).send({ isPublic: false }).expect(200);
      try {
        await http().post(`/api/v1/stories/${story}/view`).set(as('c')).expect(404);
        // İzləyici baxa bilir
        await http().post(`/api/v1/stories/${story}/view`).set(as('b')).expect(201);
      } finally {
        await http().patch('/api/v1/me').set(as('a')).send({ isPublic: true }).expect(200);
      }
    });

    it('bloklama əlaqəsində hekayəyə baxmaq olmur', async () => {
      await http().post(`/api/v1/me/blocked/${u.c.username}`).set(as('a')).send({}).expect(201);
      try {
        await http().post(`/api/v1/stories/${story}/view`).set(as('c')).expect(404);
      } finally {
        await http().delete(`/api/v1/me/blocked/${u.c.username}`).set(as('a')).expect(200);
      }
    });

    it('vaxtı bitmiş hekayə görünmür', async () => {
      await prisma.story.update({ where: { publicId: story }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect(await ringOf('b')).toBeUndefined();
      await http().post(`/api/v1/stories/${story}/view`).set(as('c')).expect(404);
    });
  });

  describe('çat — ekran 08, 09', () => {
    let conv: string;
    let socketA: Socket;
    const connect = async (key: Key) => {
      const socket = io(`${baseUrl}/ws`, { auth: { token: u[key].token }, transports: ['websocket'], reconnection: false });
      sockets.push(socket);
      await waitFor(socket, 'ready');
      return socket;
    };

    it('söhbət açmaq idempotentdir', async () => {
      const first = await http().post('/api/v1/conversations').set(as('b')).send({ username: u.a.username }).expect(201);
      const second = await http().post('/api/v1/conversations').set(as('b')).send({ username: u.a.username }).expect(201);
      expect(second.body.publicId).toBe(first.body.publicId);
      expect(first.body.other.username).toBe(u.a.username);
      conv = first.body.publicId;
      conversations.push(conv);
    });

    it('boş söhbət siyahıda görünmür', async () => {
      const res = await http().get('/api/v1/conversations').set(as('a')).expect(200);
      expect(ids(res.body)).not.toContain(conv);
    });

    it('mesaj socket ilə canlı çatdırılır', async () => {
      socketA = await connect('a');
      const incoming = waitFor<{ conversation: string; message: { body: string; isMine: boolean } }>(socketA, 'message.new');
      await http()
        .post(`/api/v1/conversations/${conv}/messages`)
        .set(as('b'))
        .send({ body: 'Salam! Şənbə günü tur var?' })
        .expect(201);

      const event = await incoming;
      expect(event.conversation).toBe(conv);
      expect(event.message).toMatchObject({ body: 'Salam! Şənbə günü tur var?', isMine: false });
    });

    it('"yazır…" yalnız iştirakçıya ötürülür', async () => {
      const socketB = await connect('b');
      const typing = waitFor(socketA, 'typing');
      socketB.emit('typing', { conversation: conv, isTyping: true });
      expect(await typing).toMatchObject({ conversation: conv, username: u.b.username, isTyping: true });
    });

    it('oxunmamış sayğac və "oxundu" işarəsi', async () => {
      const list = await http().get('/api/v1/conversations').set(as('a')).expect(200);
      const item = list.body.data.find((c: { publicId: string }) => c.publicId === conv);
      expect(item).toMatchObject({ unreadCount: 1, lastMessage: { preview: 'Salam! Şənbə günü tur var?' } });
      expect(item.other.username).toBe(u.b.username);
      expect(list.body.unreadTotal).toBeGreaterThanOrEqual(1);

      await http().post(`/api/v1/conversations/${conv}/read`).set(as('a')).expect(201);
      const msgs = await http().get(`/api/v1/conversations/${conv}/messages`).set(as('b')).expect(200);
      expect(msgs.body.data[0]).toMatchObject({ isMine: true, isRead: true });
    });

    it('təcrübə kartı anlıq görüntü ilə saxlanılır', async () => {
      const res = await http()
        .post(`/api/v1/conversations/${conv}/messages`)
        .set(as('a'))
        .send({ type: 'experience_card', target: 'kend-metbexi-masterklassi' })
        .expect(201);
      expect(res.body.payload).toMatchObject({ kind: 'experience', slug: 'kend-metbexi-masterklassi', priceAzn: 60 });
    });

    it('iştirakçı olmayan söhbəti görə bilməz', () => http().get(`/api/v1/conversations/${conv}`).set(as('c')).expect(404));

    it('tokensiz socket bağlanır', async () => {
      const anon = io(`${baseUrl}/ws`, { transports: ['websocket'], reconnection: false });
      sockets.push(anon);
      await waitFor(anon, 'disconnect');
    });

    it('gizlədilən söhbət yeni mesajla geri qayıdır', async () => {
      await http().delete(`/api/v1/conversations/${conv}`).set(as('a')).expect(200);
      let list = await http().get('/api/v1/conversations').set(as('a')).expect(200);
      expect(ids(list.body)).not.toContain(conv);

      await http().post(`/api/v1/conversations/${conv}/messages`).set(as('b')).send({ body: 'Hələ buradasan?' }).expect(201);
      list = await http().get('/api/v1/conversations').set(as('a')).expect(200);
      expect(ids(list.body)).toContain(conv);
    });
  });

  describe('rəy yazma — ekran 27', () => {
    let review: string;
    let before: { ratingAvg: number; ratingCount: number };
    const lahic = async () => {
      const row = await prisma.place.findUniqueOrThrow({ where: { slug: 'lahic' }, select: { ratingAvg: true, ratingCount: true } });
      return { ratingAvg: Number(row.ratingAvg), ratingCount: row.ratingCount };
    };
    /** Yeni rəy əlavə olunanda gözlənilən ortalama — aqreqat 2 rəqəmə yuvarlaqlaşdırılır. */
    const expectedWith = (rating: number) =>
      (before.ratingAvg * before.ratingCount + rating) / (before.ratingCount + 1);

    it('rəy +400 XP verir və məkan reytinqini yeniləyir', async () => {
      before = await lahic();
      const res = await http()
        .post('/api/v1/reviews')
        .set(as('b'))
        .send({ targetType: 'place', target: 'lahic', rating: 1, body: 'Test rəyi', tags: ['tebiet'] })
        .expect(201);
      review = res.body.publicId;
      expect(res.body.rewards.xpGained).toBe(XP_RULES.review_written.xp);
      expect(res.body).toMatchObject({ rating: 1, tags: ['tebiet'], isMine: true });

      const after = await lahic();
      expect(after.ratingCount).toBe(before.ratingCount + 1);
      expect(after.ratingAvg).toBeCloseTo(expectedWith(1), 1);
    });

    it('ikinci rəy 409 və mövcud rəyin id-si', async () => {
      const res = await http()
        .post('/api/v1/reviews')
        .set(as('b'))
        .send({ targetType: 'place', target: 'lahic', rating: 5 })
        .expect(409);
      expect(res.body.details.publicId).toBe(review);
    });

    it('naməlum çip rədd edilir', () =>
      http()
        .post('/api/v1/reviews')
        .set(as('c'))
        .send({ targetType: 'place', target: 'lahic', rating: 5, tags: ['yoxdur'] })
        .expect(400));

    it('redaktə reytinqi yenidən hesablayır; başqası redaktə edə bilməz', async () => {
      await http().patch(`/api/v1/reviews/${review}`).set(as('c')).send({ rating: 3 }).expect(403);
      await http().patch(`/api/v1/reviews/${review}`).set(as('b')).send({ rating: 5 }).expect(200);
      expect((await lahic()).ratingAvg).toBeCloseTo(expectedWith(5), 1);
    });

    it('silinən rəy yenidən yazılanda dirçəlir, XP təkrar verilmir', async () => {
      await http().delete(`/api/v1/reviews/${review}`).set(as('b')).expect(200);
      expect((await lahic()).ratingCount).toBe(before.ratingCount);

      const again = await http()
        .post('/api/v1/reviews')
        .set(as('b'))
        .send({ targetType: 'place', target: 'lahic', rating: 4 })
        .expect(201);
      expect(again.body.publicId).toBe(review);
      expect(again.body.rewards).toBeNull();

      // Seed reytinqini bərpa et
      await http().delete(`/api/v1/reviews/${review}`).set(as('b')).expect(200);
      expect(await lahic()).toEqual(before);
    });
  });

  describe('bildirişlər — ekran 07', () => {
    it('sosial tab aktyor, başlıq və deep link ilə', async () => {
      const res = await http().get('/api/v1/notifications?tab=social').set(as('a')).expect(200);
      const types = new Set(res.body.data.map((n: { type: string }) => n.type));
      expect(types).toEqual(new Set(['social_like', 'social_comment', 'social_follow']));
      expect(res.body.unreadCount).toBeGreaterThan(0);

      const like = res.body.data.find((n: { type: string }) => n.type === 'social_like');
      expect(like).toMatchObject({
        title: 'Sosial paylaşımını bəyəndi',
        deepLink: `gezgin://post/${publicPost}`,
        category: 'social',
        isRead: false,
      });
      expect(like.actor.username).toBe(u.b.username);
    });

    it('XP ilə gələn level bildirişi sistem tabındadır', async () => {
      const res = await http().get('/api/v1/notifications?tab=system').set(as('a')).expect(200);
      expect(res.body.data.some((n: { type: string }) => n.type === 'level_up')).toBe(true);
    });

    it('hamısını oxu', async () => {
      await http().post('/api/v1/notifications/read-all').set(as('a')).expect(201);
      const res = await http().get('/api/v1/notifications').set(as('a')).expect(200);
      expect(res.body.unreadCount).toBe(0);
    });
  });

  describe('bloklama', () => {
    it('bloklama əlaqəsi kontenti hər iki tərəfdən gizlədir', async () => {
      await http().post(`/api/v1/me/blocked/${u.a.username}`).set(as('c')).send({}).expect(201);
      try {
        await http().get(`/api/v1/users/${u.a.username}`).set(as('c')).expect(404);
        await http().get(`/api/v1/posts/${publicPost}`).set(as('c')).expect(404);
        const feed = await http().get('/api/v1/feed?limit=50').set(as('c')).expect(200);
        expect(ids(feed.body)).not.toContain(publicPost);
        // Bloklanan tərəf də bloklayanı görmür
        await http().get(`/api/v1/users/${u.c.username}`).set(as('a')).expect(404);
      } finally {
        await http().delete(`/api/v1/me/blocked/${u.a.username}`).set(as('c')).expect(200);
      }
      await http().get(`/api/v1/posts/${publicPost}`).set(as('c')).expect(200);
    });

    it('istifadəçi axtarışında bloklama əlaqəsi olanlar hər iki tərəfdən görünmür', async () => {
      const found = async (key: Key) => {
        const res = await http().get(`/api/v1/search?q=${tag}&types=user`).set(as(key)).expect(200);
        return res.body.results.map((r: { slug: string }) => r.slug);
      };
      expect(await found('c')).toContain(u.a.username);

      await http().post(`/api/v1/me/blocked/${u.a.username}`).set(as('c')).send({}).expect(201);
      try {
        expect(await found('c')).not.toContain(u.a.username);
        expect(await found('a')).not.toContain(u.c.username);
        expect(await found('b')).toContain(u.a.username);
      } finally {
        await http().delete(`/api/v1/me/blocked/${u.a.username}`).set(as('c')).expect(200);
      }
    });
  });

  describe('saxla, paylaş, şikayət, sil — ekran 33, 43', () => {
    it('saxlanılan paylaşım sayğacı və ekran 33', async () => {
      const saved = await http().post(`/api/v1/posts/${publicPost}/save`).set(as('b')).expect(201);
      expect(saved.body).toEqual({ saved: true, saveCount: 1 });
      await http().get('/api/v1/saved').set(as('b')).expect(200);

      const unsaved = await http().delete(`/api/v1/posts/${publicPost}/save`).set(as('b')).expect(200);
      expect(unsaved.body.saveCount).toBe(0);
    });

    it('paylaşım linki sayğacı artırır', async () => {
      const res = await http().post(`/api/v1/posts/${publicPost}/share`).set(as('c')).expect(201);
      expect(res.body).toEqual({ shareUrl: `https://gezgin.app/p/${publicPost}`, shareCount: 1 });
    });

    it('şikayət təkrarlanmır; öz paylaşımını şikayət etmək olmaz', async () => {
      const first = await http().post(`/api/v1/posts/${publicPost}/report`).set(as('c')).send({ reason: 'spam' }).expect(201);
      expect(first.body.duplicate).toBe(false);
      const again = await http().post(`/api/v1/posts/${publicPost}/report`).set(as('c')).send({ reason: 'spam' }).expect(201);
      expect(again.body).toMatchObject({ duplicate: true, publicId: first.body.publicId });

      await http().post(`/api/v1/posts/${publicPost}/report`).set(as('a')).send({ reason: 'spam' }).expect(400);
      await http().post(`/api/v1/posts/${publicPost}/report`).set(as('c')).send({ reason: 'bilmirem' }).expect(400);
    });

    it('məkan şikayəti də təkrarlanmır', async () => {
      const first = await http().post('/api/v1/places/lahic/report').set(as('c')).send({ reason: 'wrong_info' }).expect(201);
      expect(first.body.duplicate).toBe(false);
      const again = await http().post('/api/v1/places/lahic/report').set(as('c')).send({ reason: 'closed' }).expect(201);
      expect(again.body).toMatchObject({ duplicate: true, publicId: first.body.publicId });
    });

    it('silinən paylaşım saxlanılanlardan da çıxır — ekran 33 sınmır', async () => {
      await http().post(`/api/v1/posts/${followersPost}/save`).set(as('b')).expect(201);
      await http().delete(`/api/v1/posts/${followersPost}`).set(as('b')).expect(403);
      await http().delete(`/api/v1/posts/${followersPost}`).set(as('a')).expect(200);

      expect(await prisma.savedItem.count({ where: { userId: u.b.id, targetType: 'post' } })).toBe(0);
      await http().get('/api/v1/saved').set(as('b')).expect(200);
      await http().get(`/api/v1/posts/${followersPost}`).set(as('a')).expect(404);
    });
  });
});
