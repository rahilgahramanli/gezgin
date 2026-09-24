/**
 * GEZGIN — seed importeri
 *
 * `seed/` qovluğundakı CSV fayllarını MySQL-ə yükləyir.
 * Idempotentdir: `slug` / `username` açarına görə upsert edir,
 * ona görə təkrar-təkrar işlədilə bilər.
 *
 *   pnpm db:seed
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { PrismaClient, Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import * as argon2 from 'argon2';
import { LEVEL_XP, TIERS, tierForLevel, XP_RULES } from '@gezgin/shared';
import { extractHashtags } from '../src/modules/posts/hashtags';

const prisma = new PrismaClient();
const SEED_DIR = join(__dirname, '..', '..', '..', 'seed');

type Row = Record<string, string>;

function read(file: string): Row[] {
  const path = join(SEED_DIR, file);
  if (!existsSync(path)) {
    console.warn(`  ⚠  ${file} tapılmadı — keçilir`);
    return [];
  }
  const rows = parse(readFileSync(path, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Row[];
  return rows.filter((r) => Object.values(r).some((v) => v !== ''));
}

const str = (v?: string): string | null => (v && v.trim() !== '' ? v.trim() : null);
const num = (v?: string): number | null => (str(v) === null ? null : Number(v));
const dec = (v?: string): Prisma.Decimal | null => {
  const t = str(v);
  return t === null ? null : new Prisma.Decimal(t);
};
const bool = (v?: string): boolean => v === '1' || v?.toLowerCase() === 'true';
const list = (v?: string): string[] => (str(v) === null ? [] : v!.split('|').map((s) => s.trim()).filter(Boolean));
const date = (v?: string): Date | null => (str(v) === null ? null : new Date(v!));

/** `photos` sütunundakı fayl adlarını MediaAsset kimi qeydə alır. */
async function mediaFor(fileName: string | null): Promise<bigint | null> {
  if (!fileName) return null;
  const key = `seed/${fileName}`;
  const existing = await prisma.mediaAsset.findFirst({ where: { storageKey: key } });
  if (existing) return existing.id;
  const created = await prisma.mediaAsset.create({
    data: {
      publicId: ulid(),
      type: 'image',
      status: 'ready',
      storageKey: key,
      mimeType: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
      altText: fileName.replace(/\.[a-z]+$/, '').replace(/-/g, ' '),
    },
  });
  return created.id;
}

// ─────────────────────── konfiqurasiya ───────────────────────

async function seedLevels(): Promise<void> {
  for (let i = 0; i < LEVEL_XP.length; i++) {
    const level = i + 1;
    const tier = tierForLevel(level);
    await prisma.level.upsert({
      where: { level },
      update: { tierCode: tier.code, tierNameAz: tier.nameAz, tierNameEn: tier.nameEn, xpRequired: LEVEL_XP[i] },
      create: { level, tierCode: tier.code, tierNameAz: tier.nameAz, tierNameEn: tier.nameEn, xpRequired: LEVEL_XP[i] },
    });
  }
  console.log(`  ✓ levels: ${LEVEL_XP.length} (${TIERS.length} tier)`);
}

async function seedCategories(): Promise<Map<string, bigint>> {
  const rows = read('config-categories.csv');
  const map = new Map<string, bigint>();
  for (const [i, r] of rows.entries()) {
    const c = await prisma.category.upsert({
      where: { slug: r.slug },
      update: { nameAz: r.name_az, nameEn: r.name_en, nameRu: r.name_ru, icon: str(r.icon), types: r.type, sortOrder: i },
      create: { slug: r.slug, nameAz: r.name_az, nameEn: r.name_en, nameRu: r.name_ru, icon: str(r.icon), types: r.type, sortOrder: i },
    });
    map.set(r.slug, c.id);
  }
  console.log(`  ✓ categories: ${map.size}`);
  return map;
}

async function seedBadges(): Promise<void> {
  const rows = read('config-badges.csv');
  for (const [i, r] of rows.entries()) {
    const data = {
      nameAz: r.name_az,
      nameEn: r.name_en,
      descriptionAz: str(r.description_az),
      conditionType: r.condition_type as Prisma.BadgeCreateInput['conditionType'],
      conditionValue: Number(r.condition_value),
      icon: str(r.icon),
      tier: str(r.tier),
      sortOrder: i,
    };
    await prisma.badge.upsert({ where: { slug: r.slug }, update: data, create: { slug: r.slug, ...data } });
  }
  console.log(`  ✓ badges: ${rows.length}`);
}

async function seedAppSettings(): Promise<void> {
  const rules = Object.fromEntries(Object.entries(XP_RULES).map(([k, v]) => [k, v.xp]));
  const entries: Array<[string, Prisma.InputJsonValue, boolean]> = [
    ['xp_rules', rules, true],
    ['feature.social_feed', { enabled: false, sprint: 7 }, true],
    ['feature.bookings', { enabled: false, sprint: 6 }, true],
    ['feature.offline_maps', { enabled: false, sprint: 5 }, true],
    ['feature.pro_subscription', { enabled: false, sprint: 8 }, true],
  ];
  for (const [key, value, isPublic] of entries) {
    await prisma.appSetting.upsert({ where: { key }, update: { value, isPublic }, create: { key, value, isPublic } });
  }
  console.log(`  ✓ app_settings: ${entries.length}`);
}

// ─────────────────────── kontent ───────────────────────

async function seedRegions(): Promise<Map<string, bigint>> {
  const rows = read('01-regions.csv');
  const map = new Map<string, bigint>();

  // Kök element — CSV-də parent_slug "azerbaijan" kimi göstərilir
  const rootSlugs = new Set(rows.map((r) => str(r.parent_slug)).filter(Boolean) as string[]);
  for (const slug of rootSlugs) {
    if (rows.some((r) => r.slug === slug)) continue;
    const root = await prisma.region.upsert({
      where: { slug },
      update: {},
      create: { publicId: ulid(), slug, translations: { create: [{ lang: 'az', name: 'Azərbaycan' }, { lang: 'en', name: 'Azerbaijan' }, { lang: 'ru', name: 'Азербайджан' }] } },
    });
    map.set(slug, root.id);
  }

  for (const [i, r] of rows.entries()) {
    const coverId = await mediaFor(str(r.cover_photo));
    const parentId = str(r.parent_slug) ? (map.get(r.parent_slug!) ?? null) : null;
    const region = await prisma.region.upsert({
      where: { slug: r.slug },
      update: { parentId, lat: dec(r.lat), lng: dec(r.lng), coverId, isFeatured: bool(r.is_featured), sortOrder: i },
      create: { publicId: ulid(), slug: r.slug, parentId, lat: dec(r.lat), lng: dec(r.lng), coverId, isFeatured: bool(r.is_featured), sortOrder: i },
    });
    map.set(r.slug, region.id);

    for (const [lang, name, description] of [
      ['az', r.name_az, r.description_az],
      ['en', r.name_en, null],
      ['ru', r.name_ru, null],
    ] as const) {
      if (!str(name)) continue;
      await prisma.regionTranslation.upsert({
        where: { regionId_lang: { regionId: region.id, lang } },
        update: { name: name!, description: str(description ?? undefined) },
        create: { regionId: region.id, lang, name: name!, description: str(description ?? undefined) },
      });
    }
  }
  console.log(`  ✓ regions: ${rows.length}`);
  return map;
}

async function seedPlaces(regions: Map<string, bigint>, categories: Map<string, bigint>): Promise<Map<string, bigint>> {
  const rows = read('02-places.csv');
  const map = new Map<string, bigint>();
  for (const r of rows) {
    const regionId = regions.get(r.region_slug);
    if (!regionId) {
      console.warn(`  ⚠  place "${r.slug}": region "${r.region_slug}" tapılmadı — keçilir`);
      continue;
    }
    const data = {
      regionId,
      lat: dec(r.lat)!,
      lng: dec(r.lng)!,
      altitudeM: num(r.altitude_m),
      bestSeason: str(r.best_season),
      visitDurationH: dec(r.visit_duration_h),
      entranceFeeAzn: dec(r.entrance_fee_azn),
      isFeatured: bool(r.is_featured),
    };
    const place = await prisma.place.upsert({
      where: { slug: r.slug },
      update: data,
      create: { publicId: ulid(), slug: r.slug, ...data },
    });
    map.set(r.slug, place.id);

    for (const [lang, name, description] of [
      ['az', r.name_az, r.description_az],
      ['en', r.name_en, r.description_en],
      ['ru', r.name_ru, null],
    ] as const) {
      if (!str(name)) continue;
      await prisma.placeTranslation.upsert({
        where: { placeId_lang: { placeId: place.id, lang } },
        update: { name: name!, description: str(description ?? undefined) },
        create: { placeId: place.id, lang, name: name!, description: str(description ?? undefined) },
      });
    }

    const categoryId = categories.get(r.category);
    if (categoryId) {
      await prisma.placeCategory.upsert({
        where: { placeId_categoryId: { placeId: place.id, categoryId } },
        update: { isPrimary: true },
        create: { placeId: place.id, categoryId, isPrimary: true },
      });
    }

    for (const [idx, photo] of list(r.photos).entries()) {
      const mediaId = await mediaFor(photo);
      if (!mediaId) continue;
      const exists = await prisma.placePhoto.findFirst({ where: { placeId: place.id, mediaId } });
      if (!exists) {
        await prisma.placePhoto.create({
          data: { placeId: place.id, mediaId, isOfficial: true, isCover: idx === 0, sortOrder: idx },
        });
      }
    }
  }

  // region.placeCount yenilə
  for (const [slug, regionId] of regions) {
    const count = await prisma.place.count({ where: { regionId, deletedAt: null } });
    if (count > 0) await prisma.region.update({ where: { id: regionId }, data: { placeCount: count } });
    void slug;
  }
  console.log(`  ✓ places: ${map.size}`);
  return map;
}

async function seedUsers(regions: Map<string, bigint>): Promise<Map<string, bigint>> {
  const rows = read('05-users.csv');
  const map = new Map<string, bigint>();
  for (const r of rows) {
    const avatarId = await mediaFor(str(r.avatar));
    const level = Number(r.level || 1);
    const xp = LEVEL_XP[Math.min(level, LEVEL_XP.length) - 1];
    const role = (r.role === 'local_expert' ? 'local_expert' : 'gezgin') as 'local_expert' | 'gezgin';
    const data = {
      fullName: r.full_name,
      bio: str(r.bio_az),
      role,
      level,
      xp,
      gezginScore: Number(r.gezgin_score || 0),
      avatarId,
      homeRegionId: regions.get(r.region_slug) ?? null,
      isVerified: role === 'local_expert',
    };
    const user = await prisma.user.upsert({
      where: { username: r.username },
      update: data,
      create: {
        publicId: ulid(),
        username: r.username,
        email: `${r.username.replace(/\./g, '-')}@seed.gezgin.app`,
        ...data,
        settings: { create: {} },
        notificationPrefs: { create: {} },
      },
    });
    map.set(r.username, user.id);

    if (role === 'local_expert') {
      const expertData = {
        bioAz: str(r.bio_az),
        specialties: str(r.specialties),
        languages: str(r.languages),
        regions: r.region_slug,
        approvedAt: new Date(),
      };
      await prisma.expertProfile.upsert({
        where: { userId: user.id },
        update: expertData,
        create: { userId: user.id, ...expertData },
      });
    }
  }
  console.log(`  ✓ users: ${map.size} (${rows.filter((r) => r.role === 'local_expert').length} Local Expert)`);
  return map;
}

/**
 * Dev admini — admin panelinin girişi (apps/admin).
 * Şifrə `ADMIN_SEED_PASSWORD` ilə verilir; produksiyada bu funksiya işləmir.
 */
async function seedAdmin(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.log('  ⏭  admin: produksiyada yaradılmır');
    return;
  }

  const username = process.env.ADMIN_SEED_USERNAME ?? 'admin.demo';
  const password = process.env.ADMIN_SEED_PASSWORD ?? 'Sifre12345';
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.upsert({
    where: { username },
    update: { role: 'admin', status: 'active', passwordHash },
    create: {
      publicId: ulid(),
      username,
      email: `${username.replace(/\./g, '-')}@gezgin.app`,
      fullName: 'GEZGIN Admin',
      role: 'admin',
      passwordHash,
      emailVerifiedAt: new Date(),
      settings: { create: {} },
      notificationPrefs: { create: {} },
    },
  });
  console.log(`  ✓ admin: @${username} (panel girişi)`);
}

async function seedRoutes(regions: Map<string, bigint>, places: Map<string, bigint>): Promise<Map<string, bigint>> {
  const rows = read('03-routes.csv');
  const map = new Map<string, bigint>();
  for (const r of rows) {
    const regionId = regions.get(r.region_slug);
    if (!regionId) {
      console.warn(`  ⚠  route "${r.slug}": region "${r.region_slug}" tapılmadı — keçilir`);
      continue;
    }
    const coverId = await mediaFor(str(r.cover_photo));
    const data = {
      regionId,
      days: Number(r.days || 1),
      nights: Number(r.nights || 0),
      distanceKm: dec(r.distance_km),
      difficulty: (['asan', 'orta', 'cetin'].includes(r.difficulty) ? r.difficulty : 'asan') as 'asan' | 'orta' | 'cetin',
      categories: str(r.categories),
      coverId,
      visibility: (bool(r.is_official) ? 'official' : 'public') as 'official' | 'public',
    };
    const route = await prisma.route.upsert({
      where: { slug: r.slug },
      update: data,
      create: { publicId: ulid(), slug: r.slug, ...data },
    });
    map.set(r.slug, route.id);

    for (const [lang, title, description] of [
      ['az', r.title_az, r.description_az],
      ['en', r.title_en, null],
    ] as const) {
      if (!str(title)) continue;
      await prisma.routeTranslation.upsert({
        where: { routeId_lang: { routeId: route.id, lang } },
        update: { title: title!, description: str(description ?? undefined) },
        create: { routeId: route.id, lang, title: title!, description: str(description ?? undefined) },
      });
    }

    for (let d = 1; d <= data.days; d++) {
      await prisma.routeDay.upsert({
        where: { routeId_dayNumber: { routeId: route.id, dayNumber: d } },
        update: {},
        create: { routeId: route.id, dayNumber: d },
      });
    }
  }

  // dayanacaqlar
  const stops = read('04-route-stops.csv');
  let stopCount = 0;
  for (const s of stops) {
    const routeId = map.get(s.route_slug);
    const placeId = places.get(s.place_slug);
    if (!routeId || !placeId) {
      console.warn(`  ⚠  stop: route "${s.route_slug}" və ya place "${s.place_slug}" tapılmadı — keçilir`);
      continue;
    }
    const dayNumber = Number(s.day || 1);
    const sortOrder = Number(s.order || 0);
    const routeDay = await prisma.routeDay.findUnique({ where: { routeId_dayNumber: { routeId, dayNumber } } });
    const data = { placeId, routeDayId: routeDay?.id ?? null, arriveTime: str(s.arrive_time), durationMin: num(s.duration_min), noteAz: str(s.note_az) };
    await prisma.routeStop.upsert({
      where: { routeId_dayNumber_sortOrder: { routeId, dayNumber, sortOrder } },
      update: data,
      create: { routeId, dayNumber, sortOrder, ...data },
    });
    stopCount++;
  }
  console.log(`  ✓ routes: ${map.size} (${stopCount} dayanacaq)`);
  return map;
}

async function seedExperiences(
  regions: Map<string, bigint>,
  places: Map<string, bigint>,
  categories: Map<string, bigint>,
  users: Map<string, bigint>,
): Promise<number> {
  const rows = read('06-experiences.csv');
  let count = 0;
  const DURATIONS: Record<string, 'two_hours' | 'half_day' | 'full_day' | 'multi_day'> = {
    '2-saat': 'two_hours', '3-saat': 'two_hours', '5-saat': 'half_day',
    'yarim-gun': 'half_day', '1-gun': 'full_day', 'coxgunluk': 'multi_day',
  };
  for (const r of rows) {
    const expertId = users.get(r.expert_username);
    const regionId = regions.get(r.region_slug);
    if (!expertId || !regionId) {
      console.warn(`  ⚠  experience "${r.slug}": expert və ya region tapılmadı — keçilir`);
      continue;
    }
    const data = {
      expertId,
      regionId,
      placeId: str(r.place_slug) ? (places.get(r.place_slug!) ?? null) : null,
      categoryId: categories.get(r.category) ?? null,
      titleAz: r.title_az,
      titleEn: str(r.title_en),
      descriptionAz: str(r.description_az),
      duration: DURATIONS[r.duration] ?? 'half_day',
      durationText: str(r.duration),
      priceAzn: dec(r.price_azn)!,
      maxGroup: Number(r.max_group || 10),
      meetingPoint: str(r.meeting_point),
      lat: dec(r.lat),
      lng: dec(r.lng),
    };
    const exp = await prisma.experience.upsert({
      where: { slug: r.slug },
      update: data,
      create: { publicId: ulid(), slug: r.slug, ...data },
    });
    count++;

    const INCLUSION_NAMES: Record<string, string> = {
      beledci: 'Bələdçi', neqliyyat: 'Nəqliyyat', 'yerli-nahar': 'Yerli nahar',
      sigorta: 'Sığorta', materiallar: 'Materiallar',
    };
    for (const code of list(r.includes)) {
      await prisma.experienceInclusion.upsert({
        where: { experienceId_code: { experienceId: exp.id, code } },
        update: { nameAz: INCLUSION_NAMES[code] ?? code },
        create: { experienceId: exp.id, code, nameAz: INCLUSION_NAMES[code] ?? code },
      });
    }

    for (const [idx, photo] of list(r.photos).entries()) {
      const mediaId = await mediaFor(photo);
      if (!mediaId) continue;
      const exists = await prisma.experiencePhoto.findFirst({ where: { experienceId: exp.id, mediaId } });
      if (!exists) {
        await prisma.experiencePhoto.create({ data: { experienceId: exp.id, mediaId, isCover: idx === 0, sortOrder: idx } });
      }
    }
  }

  for (const [, expertId] of users) {
    const n = await prisma.experience.count({ where: { expertId, deletedAt: null } });
    if (n > 0) {
      await prisma.expertProfile.updateMany({ where: { userId: expertId }, data: { experienceCount: n } });
    }
  }
  console.log(`  ✓ experiences: ${count}`);
  return count;
}

async function seedEvents(regions: Map<string, bigint>): Promise<number> {
  const rows = read('07-events.csv');
  let count = 0;
  for (const r of rows) {
    const regionId = regions.get(r.region_slug);
    if (!regionId) continue;
    const coverId = await mediaFor(str(r.cover_photo));
    const data = {
      regionId,
      category: (['festival', 'konsert', 'sergi', 'idman'].includes(r.category) ? r.category : 'diger') as 'festival' | 'konsert' | 'sergi' | 'idman' | 'diger',
      titleAz: r.title_az,
      titleEn: str(r.title_en),
      descriptionAz: str(r.description_az),
      startDate: date(r.start_date)!,
      endDate: date(r.end_date)!,
      venue: str(r.venue),
      lat: dec(r.lat),
      lng: dec(r.lng),
      isFree: bool(r.is_free),
      priceAzn: dec(r.price_azn),
      organizer: str(r.organizer),
      coverId,
    };
    await prisma.event.upsert({ where: { slug: r.slug }, update: data, create: { publicId: ulid(), slug: r.slug, ...data } });
    count++;
  }
  console.log(`  ✓ events: ${count}`);
  return count;
}

async function seedBusinesses(regions: Map<string, bigint>): Promise<number> {
  const rows = read('08-businesses.csv');
  const map = new Map<string, bigint>();
  for (const r of rows) {
    const regionId = regions.get(r.region_slug);
    if (!regionId) continue;
    const coverId = await mediaFor(str(r.cover_photo));
    const logoId = await mediaFor(str(r.logo));
    const data = {
      regionId,
      type: (['otel', 'restoran', 'qonaq_evi', 'tur_sirketi'].includes(r.type) ? r.type : 'diger') as 'otel' | 'restoran' | 'qonaq_evi' | 'tur_sirketi' | 'diger',
      name: r.name,
      descriptionAz: str(r.description_az),
      services: str(r.services),
      lat: dec(r.lat),
      lng: dec(r.lng),
      phone: str(r.phone),
      website: str(r.website),
      coverId,
      logoId,
    };
    const biz = await prisma.business.upsert({ where: { slug: r.slug }, update: data, create: { publicId: ulid(), slug: r.slug, ...data } });
    map.set(r.slug, biz.id);
  }

  const packages = read('09-business-packages.csv');
  let pkgCount = 0;
  for (const [i, p] of packages.entries()) {
    const businessId = map.get(p.business_slug);
    if (!businessId) continue;
    const existing = await prisma.businessPackage.findFirst({ where: { businessId, titleAz: p.title_az } });
    const data = {
      businessId,
      titleAz: p.title_az,
      descriptionAz: str(p.description_az),
      nights: Number(p.nights || 1),
      days: Number(p.days || 2),
      priceAzn: dec(p.price_azn)!,
      includes: str(p.includes),
      sortOrder: i,
    };
    if (existing) await prisma.businessPackage.update({ where: { id: existing.id }, data });
    else await prisma.businessPackage.create({ data: { publicId: ulid(), ...data } });
    pkgCount++;
  }
  console.log(`  ✓ businesses: ${map.size} (${pkgCount} paket)`);
  return map.size;
}

async function seedReviews(users: Map<string, bigint>): Promise<number> {
  const rows = read('10-reviews.csv');
  type Target = 'place' | 'route' | 'experience' | 'business' | 'event';

  const resolvers: Record<Target, (slug: string) => Promise<{ id: bigint } | null>> = {
    place: (slug) => prisma.place.findUnique({ where: { slug }, select: { id: true } }),
    route: (slug) => prisma.route.findUnique({ where: { slug }, select: { id: true } }),
    experience: (slug) => prisma.experience.findUnique({ where: { slug }, select: { id: true } }),
    business: (slug) => prisma.business.findUnique({ where: { slug }, select: { id: true } }),
    event: (slug) => prisma.event.findUnique({ where: { slug }, select: { id: true } }),
  };

  let count = 0;
  for (const r of rows) {
    const userId = users.get(r.username);
    const type = r.target_type as Target;
    const target = resolvers[type] ? await resolvers[type](r.target_slug) : null;
    if (!userId || !target) {
      console.warn(`  ⚠  review: ${r.target_type}/${r.target_slug} və ya @${r.username} tapılmadı — keçilir`);
      continue;
    }

    const createdAt = new Date(Date.now() - Number(r.days_ago || 0) * 86400_000);
    const data = {
      rating: Number(r.rating),
      body: str(r.body_az),
      tags: str(r.tags),
      createdAt,
    };

    const review = await prisma.review.upsert({
      where: { userId_targetType_targetId: { userId, targetType: type, targetId: target.id } },
      update: data,
      create: { publicId: ulid(), userId, targetType: type, targetId: target.id, ...data },
    });
    count++;

    for (const [idx, photo] of list(r.photos).entries()) {
      const mediaId = await mediaFor(photo);
      if (!mediaId) continue;
      const exists = await prisma.reviewPhoto.findFirst({ where: { reviewId: review.id, mediaId } });
      if (!exists) await prisma.reviewPhoto.create({ data: { reviewId: review.id, mediaId, sortOrder: idx } });
    }
  }

  // Reytinq aqreqatlarını yenilə — API bunları hesablamır, oxuyur.
  const agg = await prisma.review.groupBy({
    by: ['targetType', 'targetId'],
    where: { deletedAt: null, isVisible: true },
    _avg: { rating: true },
    _count: { rating: true },
  });

  for (const a of agg) {
    const avg = Math.round((a._avg.rating ?? 0) * 100) / 100;
    const payload = { ratingAvg: new Prisma.Decimal(avg), ratingCount: a._count.rating };
    if (a.targetType === 'place') await prisma.place.update({ where: { id: a.targetId }, data: payload });
    else if (a.targetType === 'route') await prisma.route.update({ where: { id: a.targetId }, data: payload });
    else if (a.targetType === 'experience') await prisma.experience.update({ where: { id: a.targetId }, data: payload });
    else if (a.targetType === 'business') await prisma.business.update({ where: { id: a.targetId }, data: payload });
  }

  // Local Expert profil reytinqi təcrübələrinin ortalamasıdır
  const experts = await prisma.expertProfile.findMany({ select: { userId: true } });
  for (const e of experts) {
    const exps = await prisma.experience.findMany({
      where: { expertId: e.userId, ratingCount: { gt: 0 } },
      select: { ratingAvg: true, ratingCount: true },
    });
    if (!exps.length) continue;
    const total = exps.reduce((n, x) => n + x.ratingCount, 0);
    const sum = exps.reduce((n, x) => n + Number(x.ratingAvg) * x.ratingCount, 0);
    await prisma.expertProfile.update({
      where: { userId: e.userId },
      data: { ratingAvg: new Prisma.Decimal(Math.round((sum / total) * 100) / 100), ratingCount: total },
    });
  }

  console.log(`  ✓ reviews: ${count} (reytinqlər yeniləndi: ${agg.length} obyekt)`);
  return count;
}

async function seedSubscriptionPlans(): Promise<void> {
  const plans = [
    { code: 'gezgin_pro' as const, interval: 'year', nameAz: 'Gezgin PRO — illik', priceAzn: '79.99', sortOrder: 0 },
    { code: 'gezgin_pro' as const, interval: 'month', nameAz: 'Gezgin PRO — aylıq', priceAzn: '9.99', sortOrder: 1 },
  ];
  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code_interval: { code: p.code, interval: p.interval } },
      update: { nameAz: p.nameAz, priceAzn: new Prisma.Decimal(p.priceAzn), sortOrder: p.sortOrder },
      create: { ...p, priceAzn: new Prisma.Decimal(p.priceAzn), features: { offlineMaps: true, adFree: true, proPlanner: true, prioritySupport: true, bookingDiscount: 0.15 } },
    });
  }
  console.log(`  ✓ subscription_plans: ${plans.length}`);
}

// ─────────────────────── sosial (Sprint 7) ───────────────────────

async function seedFollows(users: Map<string, bigint>): Promise<number> {
  let count = 0;
  for (const r of read('12-follows.csv')) {
    const followerId = users.get(r.follower);
    const followingId = users.get(r.following);
    if (!followerId || !followingId || followerId === followingId) {
      console.warn(`  ⚠  follow: @${r.follower} → @${r.following} tapılmadı — keçilir`);
      continue;
    }
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { followerId, followingId },
    });
    count++;
  }
  console.log(`  ✓ follows: ${count}`);
  return count;
}

/**
 * Paylaşımların slug-ı yoxdur — idempotentlik üçün (müəllif, mətn) cütü açardır.
 * `ref` sütunu yalnız şərh CSV-sinin paylaşıma istinad etməsi üçündür.
 */
async function seedPosts(users: Map<string, bigint>): Promise<Map<string, bigint>> {
  const refs = new Map<string, bigint>();
  for (const r of read('11-posts.csv')) {
    const userId = users.get(r.username);
    if (!userId) {
      console.warn(`  ⚠  post: @${r.username} tapılmadı — keçilir`);
      continue;
    }
    const place = str(r.place_slug)
      ? await prisma.place.findUnique({ where: { slug: r.place_slug }, select: { id: true, lat: true, lng: true } })
      : null;
    const route = str(r.route_slug)
      ? await prisma.route.findUnique({ where: { slug: r.route_slug }, select: { id: true } })
      : null;
    if (str(r.place_slug) && !place) console.warn(`  ⚠  post ${r.ref}: məkan ${r.place_slug} tapılmadı`);

    const body = str(r.body_az);
    const hashtags = extractHashtags(body);
    const createdAt = new Date(Date.now() - Number(r.hours_ago || 0) * 3600_000);
    const data = {
      placeId: place?.id ?? null,
      routeId: route?.id ?? null,
      visibility: (str(r.visibility) ?? 'public') as 'public' | 'followers' | 'private',
      body,
      hashtags: hashtags.length ? hashtags.join('|') : null,
      // Nearby lenti koordinatdan işləyir — məkanınkı götürülür
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      createdAt,
      deletedAt: null,
    };

    const existing = await prisma.post.findFirst({ where: { userId, body }, select: { id: true } });
    const post = existing
      ? await prisma.post.update({ where: { id: existing.id }, data })
      : await prisma.post.create({ data: { publicId: ulid(createdAt.getTime()), userId, ...data } });

    await prisma.postMedia.deleteMany({ where: { postId: post.id } });
    for (const [idx, photo] of list(r.photos).entries()) {
      const mediaId = await mediaFor(photo);
      if (mediaId) await prisma.postMedia.create({ data: { postId: post.id, mediaId, sortOrder: idx } });
    }

    for (const liker of list(r.likes_by)) {
      const likerId = users.get(liker);
      if (!likerId || likerId === userId) continue;
      await prisma.postLike.upsert({
        where: { postId_userId: { postId: post.id, userId: likerId } },
        update: {},
        create: { postId: post.id, userId: likerId, createdAt },
      });
    }
    const likeCount = await prisma.postLike.count({ where: { postId: post.id } });
    await prisma.post.update({ where: { id: post.id }, data: { likeCount } });

    if (str(r.ref)) refs.set(r.ref, post.id);
  }
  console.log(`  ✓ posts: ${refs.size}`);
  return refs;
}

async function seedComments(users: Map<string, bigint>, posts: Map<string, bigint>): Promise<number> {
  let count = 0;
  for (const r of read('13-comments.csv')) {
    const postId = posts.get(r.post_ref);
    const userId = users.get(r.username);
    if (!postId || !userId) {
      console.warn(`  ⚠  comment: ${r.post_ref} və ya @${r.username} tapılmadı — keçilir`);
      continue;
    }
    const post = await prisma.post.findUniqueOrThrow({ where: { id: postId }, select: { createdAt: true } });
    const createdAt = new Date(post.createdAt.getTime() + Number(r.minutes_after || 0) * 60_000);

    // `reply_to` — həmin istifadəçinin bu paylaşımdakı kök şərhi
    let parentId: bigint | null = null;
    const replyTo = str(r.reply_to) ? users.get(r.reply_to) : undefined;
    if (replyTo) {
      const parent = await prisma.comment.findFirst({
        where: { postId, userId: replyTo, parentId: null },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      parentId = parent?.id ?? null;
    }

    const body = r.body_az;
    const existing = await prisma.comment.findFirst({ where: { postId, userId, body }, select: { id: true } });
    if (existing) {
      await prisma.comment.update({ where: { id: existing.id }, data: { parentId, createdAt, deletedAt: null } });
    } else {
      await prisma.comment.create({
        data: { publicId: ulid(createdAt.getTime()), postId, userId, parentId, body, createdAt },
      });
    }
    count++;
  }

  // Sayğac API-də artırılır; seed üçün birbaşa hesablanır
  for (const postId of posts.values()) {
    const commentCount = await prisma.comment.count({ where: { postId, deletedAt: null } });
    await prisma.post.update({ where: { id: postId }, data: { commentCount } });
  }
  console.log(`  ✓ comments: ${count}`);
  return count;
}

/**
 * Hekayə 24 saat yaşayır. Seed hər işləyəndə vaxtı indiyə görə yeniləyir —
 * demo üçün `pnpm db:seed` hekayələri yenidən "canlandırır".
 */
async function seedStories(users: Map<string, bigint>): Promise<number> {
  let count = 0;
  for (const r of read('14-stories.csv')) {
    const userId = users.get(r.username);
    const mediaId = await mediaFor(str(r.photo));
    if (!userId || !mediaId) {
      console.warn(`  ⚠  story: @${r.username} və ya ${r.photo} tapılmadı — keçilir`);
      continue;
    }
    const place = str(r.place_slug)
      ? await prisma.place.findUnique({ where: { slug: r.place_slug }, select: { id: true } })
      : null;
    const createdAt = new Date(Date.now() - Number(r.hours_ago || 0) * 3600_000);
    const data = {
      placeId: place?.id ?? null,
      caption: str(r.caption),
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 24 * 3600_000),
      deletedAt: null,
    };

    const existing = await prisma.story.findFirst({ where: { userId, mediaId }, select: { id: true } });
    if (existing) await prisma.story.update({ where: { id: existing.id }, data });
    else await prisma.story.create({ data: { publicId: ulid(createdAt.getTime()), userId, mediaId, ...data } });
    count++;
  }
  console.log(`  ✓ stories: ${count} (24 saat aktiv)`);
  return count;
}

async function main(): Promise<void> {
  console.log('\n🌱 GEZGIN seed başlayır\n');
  console.log('Konfiqurasiya:');
  await seedLevels();
  const categories = await seedCategories();
  await seedBadges();
  await seedAppSettings();
  await seedSubscriptionPlans();

  console.log('\nKontent:');
  const regions = await seedRegions();
  const places = await seedPlaces(regions, categories);
  const users = await seedUsers(regions);
  await seedAdmin();
  await seedRoutes(regions, places);
  await seedExperiences(regions, places, categories, users);
  await seedEvents(regions);
  await seedBusinesses(regions);
  await seedReviews(users);

  console.log('\nSosial:');
  await seedFollows(users);
  const posts = await seedPosts(users);
  await seedComments(users, posts);
  await seedStories(users);

  console.log('\n✅ Seed tamamlandı\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed uğursuz oldu:\n', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
