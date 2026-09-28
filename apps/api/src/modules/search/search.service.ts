import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { distanceMeters, formatDistanceKm } from '@/common/search/geo';
import { toBooleanQuery } from '@/common/search/normalize';
import { translationJoin } from '@/common/search/translation';
import { dayMonthText, daysText, levelText, pickTr, titleFor, trWhere } from '@/common/i18n';

type Lang = 'az' | 'en' | 'ru';
export type SearchType = 'place' | 'route' | 'experience' | 'event' | 'user' | 'business';

export interface SearchOptions {
  q: string;
  types?: SearchType[];
  region?: string;
  lat?: number;
  lng?: number;
  limit?: number;
}

export interface SearchHit {
  type: SearchType;
  slug: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  priceAzn: number | null;
  distanceKm: number | null;
  score: number;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  /**
   * Ekran 11 — qarışıq nəticələr. Hər tip ayrıca sorğu ilə axtarılır və
   * FULLTEXT relevans balına görə birləşdirilir.
   */
  async search(opts: SearchOptions, lang: Lang, userId?: bigint) {
    const bq = toBooleanQuery(opts.q);
    if (!bq) return { query: opts.q, total: 0, results: [] as SearchHit[] };

    const types = opts.types?.length ? opts.types : (['place', 'route', 'experience', 'event', 'user'] as SearchType[]);
    const limit = opts.limit ?? 20;
    const hasGeo = opts.lat !== undefined && opts.lng !== undefined;
    const perType = Math.max(3, Math.ceil(limit / types.length) + 2);
    const hits: SearchHit[] = [];

    if (types.includes('place')) {
      const rows = await this.prisma.$queryRaw<Array<{ slug: string; name: string; region_name: string; cover_key: string | null; rating_avg: Prisma.Decimal; rating_count: number; distance_m: number | null; score: number }>>`
        SELECT p.slug, t.name, rt.name AS region_name,
               (SELECT m.storage_key FROM place_photos ph JOIN media_assets m ON m.id = ph.media_id
                WHERE ph.place_id = p.id AND m.deleted_at IS NULL
                ORDER BY ph.is_cover DESC, ph.sort_order ASC LIMIT 1) AS cover_key,
               p.rating_avg, p.rating_count,
               ${hasGeo ? distanceMeters('p.geo', opts.lng!, opts.lat!) : Prisma.sql`NULL`} AS distance_m,
               MATCH(t.search_text) AGAINST(${bq} IN BOOLEAN MODE) AS score
        FROM places p
        ${translationJoin({ table: 'place_translations', fk: 'place_id', alias: 't', owner: 'p', lang })}
        JOIN regions r ON r.id = p.region_id
        ${translationJoin({ table: 'region_translations', fk: 'region_id', alias: 'rt', owner: 'r', lang, left: true })}
        WHERE p.deleted_at IS NULL AND p.status = 'published'
          AND MATCH(t.search_text) AGAINST(${bq} IN BOOLEAN MODE)
          ${opts.region ? Prisma.sql`AND r.slug = ${opts.region}` : Prisma.empty}
        ORDER BY score DESC LIMIT ${perType}
      `;
      hits.push(...rows.map((r) => ({
        type: 'place' as const,
        slug: r.slug,
        title: r.name,
        subtitle: r.region_name,
        imageUrl: this.url(r.cover_key),
        rating: Number(r.rating_avg),
        ratingCount: r.rating_count,
        priceAzn: null,
        distanceKm: formatDistanceKm(r.distance_m === null ? null : Number(r.distance_m)),
        score: Number(r.score),
      })));
    }

    if (types.includes('route')) {
      const rows = await this.prisma.$queryRaw<Array<{ slug: string; title: string; days: number; region_name: string; cover_key: string | null; rating_avg: Prisma.Decimal; rating_count: number; score: number }>>`
        SELECT ro.slug, t.title, ro.days, rt.name AS region_name, m.storage_key AS cover_key,
               ro.rating_avg, ro.rating_count,
               MATCH(t.search_text) AGAINST(${bq} IN BOOLEAN MODE) AS score
        FROM routes ro
        ${translationJoin({ table: 'route_translations', fk: 'route_id', alias: 't', owner: 'ro', lang })}
        JOIN regions r ON r.id = ro.region_id
        ${translationJoin({ table: 'region_translations', fk: 'region_id', alias: 'rt', owner: 'r', lang, left: true })}
        LEFT JOIN media_assets m ON m.id = ro.cover_id
        WHERE ro.deleted_at IS NULL AND ro.status = 'published' AND ro.visibility <> 'private'
          AND MATCH(t.search_text) AGAINST(${bq} IN BOOLEAN MODE)
          ${opts.region ? Prisma.sql`AND r.slug = ${opts.region}` : Prisma.empty}
        ORDER BY score DESC LIMIT ${perType}
      `;
      hits.push(...rows.map((r) => ({
        type: 'route' as const,
        slug: r.slug,
        title: r.title,
        subtitle: `${daysText(r.days, lang)} · ${r.region_name}`,
        imageUrl: this.url(r.cover_key),
        rating: Number(r.rating_avg),
        ratingCount: r.rating_count,
        priceAzn: null,
        distanceKm: null,
        score: Number(r.score),
      })));
    }

    if (types.includes('experience')) {
      const rows = await this.prisma.$queryRaw<Array<{ slug: string; title_az: string; title_en: string | null; price_azn: Prisma.Decimal; rating_avg: Prisma.Decimal; rating_count: number; region_name: string; cover_key: string | null; score: number }>>`
        SELECT e.slug, e.title_az, e.title_en, e.price_azn, e.rating_avg, e.rating_count,
               rt.name AS region_name,
               (SELECT m.storage_key FROM experience_photos ep JOIN media_assets m ON m.id = ep.media_id
                WHERE ep.experience_id = e.id AND m.deleted_at IS NULL
                ORDER BY ep.is_cover DESC, ep.sort_order ASC LIMIT 1) AS cover_key,
               MATCH(e.search_text) AGAINST(${bq} IN BOOLEAN MODE) AS score
        FROM experiences e
        JOIN regions r ON r.id = e.region_id
        ${translationJoin({ table: 'region_translations', fk: 'region_id', alias: 'rt', owner: 'r', lang, left: true })}
        WHERE e.deleted_at IS NULL AND e.status = 'published'
          AND MATCH(e.search_text) AGAINST(${bq} IN BOOLEAN MODE)
          ${opts.region ? Prisma.sql`AND r.slug = ${opts.region}` : Prisma.empty}
        ORDER BY score DESC LIMIT ${perType}
      `;
      hits.push(...rows.map((r) => ({
        type: 'experience' as const,
        slug: r.slug,
        title: titleFor({ titleAz: r.title_az, titleEn: r.title_en }, lang),
        subtitle: r.region_name,
        imageUrl: this.url(r.cover_key),
        rating: Number(r.rating_avg),
        ratingCount: r.rating_count,
        priceAzn: Number(r.price_azn),
        distanceKm: null,
        score: Number(r.score),
      })));
    }

    if (types.includes('event')) {
      const rows = await this.prisma.$queryRaw<Array<{ slug: string; title_az: string; title_en: string | null; start_date: Date; region_name: string; cover_key: string | null; score: number }>>`
        SELECT ev.slug, ev.title_az, ev.title_en, ev.start_date, rt.name AS region_name, m.storage_key AS cover_key,
               MATCH(ev.search_text) AGAINST(${bq} IN BOOLEAN MODE) AS score
        FROM events ev
        JOIN regions r ON r.id = ev.region_id
        ${translationJoin({ table: 'region_translations', fk: 'region_id', alias: 'rt', owner: 'r', lang, left: true })}
        LEFT JOIN media_assets m ON m.id = ev.cover_id
        WHERE ev.deleted_at IS NULL AND ev.end_date >= CURDATE()
          AND MATCH(ev.search_text) AGAINST(${bq} IN BOOLEAN MODE)
          ${opts.region ? Prisma.sql`AND r.slug = ${opts.region}` : Prisma.empty}
        ORDER BY score DESC LIMIT ${perType}
      `;
      hits.push(...rows.map((r) => ({
        type: 'event' as const,
        slug: r.slug,
        title: titleFor({ titleAz: r.title_az, titleEn: r.title_en }, lang),
        subtitle: `${dayMonthText(new Date(r.start_date), lang)} · ${r.region_name}`,
        imageUrl: this.url(r.cover_key),
        rating: null,
        ratingCount: null,
        priceAzn: null,
        distanceKm: null,
        score: Number(r.score),
      })));
    }

    if (types.includes('user')) {
      const rows = await this.prisma.$queryRaw<Array<{ username: string; full_name: string; level: number; role: string; avatar_key: string | null; score: number }>>`
        SELECT u.username, u.full_name, u.level, u.role, m.storage_key AS avatar_key,
               MATCH(u.search_text) AGAINST(${bq} IN BOOLEAN MODE) AS score
        FROM users u
        LEFT JOIN media_assets m ON m.id = u.avatar_id
        WHERE u.deleted_at IS NULL AND u.status = 'active' AND u.is_public = 1
          AND MATCH(u.search_text) AGAINST(${bq} IN BOOLEAN MODE)
          ${userId !== undefined
            ? Prisma.sql`AND NOT EXISTS (
                SELECT 1 FROM blocks b
                WHERE (b.blocker_id = ${userId} AND b.blocked_id = u.id)
                   OR (b.blocker_id = u.id AND b.blocked_id = ${userId})
              )`
            : Prisma.empty}
        ORDER BY score DESC, u.gezgin_score DESC LIMIT ${perType}
      `;
      hits.push(...rows.map((r) => ({
        type: 'user' as const,
        slug: r.username,
        title: r.full_name,
        subtitle: r.role === 'local_expert' ? `Local Expert · ${levelText(r.level, lang)}` : levelText(r.level, lang),
        imageUrl: this.url(r.avatar_key),
        rating: null,
        ratingCount: null,
        priceAzn: null,
        distanceKm: null,
        score: Number(r.score),
      })));
    }

    hits.sort((a, b) => b.score - a.score);
    const results = hits.slice(0, limit);

    if (userId) {
      await this.prisma.searchHistory.create({
        data: { userId, query: opts.q.slice(0, 190), resultCount: results.length },
      });
    }

    return { query: opts.q, total: hits.length, results };
  }

  /** Yazarkən görünən təkliflər — ekran 11. */
  async suggest(q: string, lang: Lang, limit = 8) {
    const bq = toBooleanQuery(q);
    if (!bq) return [];

    const rows = await this.prisma.$queryRaw<Array<{ kind: string; slug: string; label: string; score: number }>>`
      (SELECT 'place' AS kind, p.slug, t.name AS label,
              MATCH(t.search_text) AGAINST(${bq} IN BOOLEAN MODE) AS score
       FROM places p ${translationJoin({ table: 'place_translations', fk: 'place_id', alias: 't', owner: 'p', lang })}
       WHERE p.deleted_at IS NULL AND MATCH(t.search_text) AGAINST(${bq} IN BOOLEAN MODE)
       ORDER BY score DESC LIMIT ${limit})
      UNION ALL
      (SELECT 'region', r.slug, rt.name,
              MATCH(rt.search_text) AGAINST(${bq} IN BOOLEAN MODE)
       FROM regions r ${translationJoin({ table: 'region_translations', fk: 'region_id', alias: 'rt', owner: 'r', lang })}
       WHERE r.parent_id IS NOT NULL AND MATCH(rt.search_text) AGAINST(${bq} IN BOOLEAN MODE)
       ORDER BY 4 DESC LIMIT ${limit})
      ORDER BY score DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ type: r.kind, slug: r.slug, label: r.label }));
  }

  /** Ekran 11 "Son axtarışlar". */
  async recent(userId: bigint, limit = 8) {
    const rows = await this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      distinct: ['query'],
      take: limit,
      select: { query: true, createdAt: true, resultCount: true },
    });
    return rows;
  }

  async clearRecent(userId: bigint) {
    await this.prisma.searchHistory.deleteMany({ where: { userId } });
    return { cleared: true };
  }

  /** Ekran 11 "Populyar axtarışlar" — son 30 günün ən çox təkrarlananları. */
  async popular(limit = 8) {
    const rows = await this.prisma.searchHistory.groupBy({
      by: ['query'],
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) }, resultCount: { gt: 0 } },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: limit,
    });

    if (rows.length) return rows.map((r) => ({ query: r.query, count: r._count.query }));

    // Soyuq start: hələ axtarış tarixçəsi yoxdursa, seçilmiş məkanları təklif edirik
    const featured = await this.prisma.place.findMany({
      where: { isFeatured: true, deletedAt: null },
      select: { translations: { where: trWhere(), select: { lang: true, name: true } } },
      take: limit,
    });
    return featured.map((f) => ({ query: pickTr(f.translations)?.name ?? '', count: 0 })).filter((f) => f.query);
  }
}
