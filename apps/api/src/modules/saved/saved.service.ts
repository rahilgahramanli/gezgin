import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SavedItemType } from '@prisma/client';
import { ulid } from 'ulid';
import { ERROR_CODES } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import type { CreateCollectionDto, ListSavedDto, SaveItemDto, UpdateCollectionDto } from './dto/saved.dto';

type Lang = 'az' | 'en' | 'ru';

interface ResolvedTarget {
  id: bigint;
  title: string;
  subtitle: string | null;
  imageKey: string | null;
  rating: number | null;
  priceAzn: number | null;
}

@Injectable()
export class SavedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  /**
   * Saxlanılanlar polimorfikdir — hər tip üçün slug-dan ID və göstəriləcək
   * məlumat çıxarılır. Ekran 33-də hamısı eyni sətir formatında görünür.
   */
  private async resolve(type: SavedItemType, target: string, lang: Lang): Promise<ResolvedTarget> {
    const notFound = () =>
      new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `Tapılmadı: ${type}/${target}` });

    if (type === 'place') {
      const row = await this.prisma.place.findFirst({
        where: { slug: target, deletedAt: null },
        include: {
          translations: { select: { lang: true, name: true } },
          region: { include: { translations: { select: { lang: true, name: true } } } },
          photos: {
            where: { media: { deletedAt: null } },
            include: { media: { select: { storageKey: true } } },
            orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
          },
        },
      });
      if (!row) throw notFound();
      const t = row.translations.find((x) => x.lang === lang) ?? row.translations.find((x) => x.lang === 'az');
      const rt = row.region.translations.find((x) => x.lang === lang) ?? row.region.translations.find((x) => x.lang === 'az');
      return {
        id: row.id,
        title: t?.name ?? row.slug,
        subtitle: rt?.name ?? null,
        imageKey: row.photos[0]?.media.storageKey ?? null,
        rating: Number(row.ratingAvg),
        priceAzn: null,
      };
    }

    if (type === 'route') {
      const row = await this.prisma.route.findFirst({
        where: { slug: target, deletedAt: null },
        include: {
          translations: { select: { lang: true, title: true } },
          region: { include: { translations: { select: { lang: true, name: true } } } },
          cover: { select: { storageKey: true } },
        },
      });
      if (!row) throw notFound();
      const t = row.translations.find((x) => x.lang === lang) ?? row.translations.find((x) => x.lang === 'az');
      const rt = row.region.translations.find((x) => x.lang === lang) ?? row.region.translations.find((x) => x.lang === 'az');
      return {
        id: row.id,
        title: t?.title ?? row.slug,
        subtitle: `${row.days} gün · ${rt?.name ?? row.region.slug}`,
        imageKey: row.cover?.storageKey ?? null,
        rating: Number(row.ratingAvg),
        priceAzn: null,
      };
    }

    if (type === 'experience') {
      const row = await this.prisma.experience.findFirst({
        where: { slug: target, deletedAt: null },
        include: {
          region: { include: { translations: { select: { lang: true, name: true } } } },
          photos: {
            where: { media: { deletedAt: null } },
            include: { media: { select: { storageKey: true } } },
            orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
          },
        },
      });
      if (!row) throw notFound();
      const rt = row.region.translations.find((x) => x.lang === lang) ?? row.region.translations.find((x) => x.lang === 'az');
      return {
        id: row.id,
        title: row.titleAz,
        subtitle: rt?.name ?? null,
        imageKey: row.photos[0]?.media.storageKey ?? null,
        rating: Number(row.ratingAvg),
        priceAzn: Number(row.priceAzn),
      };
    }

    if (type === 'event') {
      const row = await this.prisma.event.findFirst({
        where: { slug: target, deletedAt: null },
        include: {
          region: { include: { translations: { select: { lang: true, name: true } } } },
          cover: { select: { storageKey: true } },
        },
      });
      if (!row) throw notFound();
      const rt = row.region.translations.find((x) => x.lang === lang) ?? row.region.translations.find((x) => x.lang === 'az');
      return {
        id: row.id,
        title: row.titleAz,
        subtitle: rt?.name ?? null,
        imageKey: row.cover?.storageKey ?? null,
        rating: null,
        priceAzn: row.priceAzn === null ? null : Number(row.priceAzn),
      };
    }

    if (type === 'business') {
      const row = await this.prisma.business.findFirst({
        where: { slug: target, deletedAt: null },
        include: { cover: { select: { storageKey: true } } },
      });
      if (!row) throw notFound();
      return {
        id: row.id,
        title: row.name,
        subtitle: row.type,
        imageKey: row.cover?.storageKey ?? null,
        rating: Number(row.ratingAvg),
        priceAzn: null,
      };
    }

    // post — publicId ilə
    const row = await this.prisma.post.findFirst({
      where: { publicId: target, deletedAt: null },
      include: {
        user: { select: { fullName: true } },
        media: { include: { media: { select: { storageKey: true } } }, orderBy: { sortOrder: 'asc' }, take: 1 },
      },
    });
    if (!row) throw notFound();
    return {
      id: row.id,
      title: row.body?.slice(0, 80) ?? 'Paylaşım',
      subtitle: row.user.fullName,
      imageKey: row.media[0]?.media.storageKey ?? null,
      rating: null,
      priceAzn: null,
    };
  }

  /** Saxlanılan sətirlərin göstəriləcək məlumatını tiplər üzrə toplu yükləyir. */
  private async hydrate(
    rows: Array<{ id: bigint; targetType: SavedItemType; targetId: bigint; createdAt: Date }>,
    lang: Lang,
  ) {
    const byType = new Map<SavedItemType, bigint[]>();
    for (const r of rows) {
      const list = byType.get(r.targetType) ?? [];
      list.push(r.targetId);
      byType.set(r.targetType, list);
    }

    const slugById = new Map<string, string>();
    for (const [type, ids] of byType) {
      const key = (id: bigint) => `${type}:${id}`;
      if (type === 'place') {
        const found = await this.prisma.place.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } });
        for (const f of found) slugById.set(key(f.id), f.slug);
      } else if (type === 'route') {
        const found = await this.prisma.route.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } });
        for (const f of found) slugById.set(key(f.id), f.slug);
      } else if (type === 'experience') {
        const found = await this.prisma.experience.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } });
        for (const f of found) slugById.set(key(f.id), f.slug);
      } else if (type === 'event') {
        const found = await this.prisma.event.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } });
        for (const f of found) slugById.set(key(f.id), f.slug);
      } else if (type === 'business') {
        const found = await this.prisma.business.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } });
        for (const f of found) slugById.set(key(f.id), f.slug);
      } else {
        const found = await this.prisma.post.findMany({ where: { id: { in: ids } }, select: { id: true, publicId: true } });
        for (const f of found) slugById.set(key(f.id), f.publicId);
      }
    }

    const out = [];
    for (const r of rows) {
      const slug = slugById.get(`${r.targetType}:${r.targetId}`);
      if (!slug) continue; // hədəf silinib
      const target = await this.resolve(r.targetType, slug, lang);
      out.push({
        savedId: Number(r.id),
        type: r.targetType,
        slug,
        title: target.title,
        subtitle: target.subtitle,
        imageUrl: this.url(target.imageKey),
        rating: target.rating,
        priceAzn: target.priceAzn,
        savedAt: r.createdAt,
      });
    }
    return out;
  }

  /** Ekran 33 — Want to go. */
  async list(userId: bigint, dto: ListSavedDto, lang: Lang) {
    let savedIdFilter: bigint[] | undefined;
    if (dto.collection) {
      const collection = await this.prisma.collection.findFirst({
        where: { publicId: dto.collection, userId },
        include: { items: { select: { savedItemId: true } } },
      });
      if (!collection) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Kolleksiya tapılmadı' });
      savedIdFilter = collection.items.map((i) => i.savedItemId);
    }

    const where = {
      userId,
      ...(dto.type ? { targetType: dto.type } : {}),
      ...(savedIdFilter ? { id: { in: savedIdFilter } } : {}),
    };

    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;

    const [rows, counts] = await Promise.all([
      this.prisma.savedItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit + 1,
      }),
      this.prisma.savedItem.groupBy({ by: ['targetType'], where: { userId }, _count: true }),
    ]);

    const hasMore = rows.length > limit;
    const byType = Object.fromEntries(counts.map((c) => [c.targetType, c._count]));

    return {
      counts: {
        all: counts.reduce((n, c) => n + c._count, 0),
        place: byType.place ?? 0,
        route: byType.route ?? 0,
        experience: byType.experience ?? 0,
        event: byType.event ?? 0,
        post: byType.post ?? 0,
        business: byType.business ?? 0,
      },
      data: await this.hydrate(rows.slice(0, limit), lang),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  async save(userId: bigint, dto: SaveItemDto, lang: Lang) {
    const target = await this.resolve(dto.type, dto.target, lang);

    const saved = await this.prisma.savedItem.upsert({
      where: { userId_targetType_targetId: { userId, targetType: dto.type, targetId: target.id } },
      update: {},
      create: { userId, targetType: dto.type, targetId: target.id },
    });

    if (dto.collection) {
      const collection = await this.prisma.collection.findFirst({
        where: { publicId: dto.collection, userId },
      });
      if (!collection) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Kolleksiya tapılmadı' });

      await this.prisma.collectionItem.upsert({
        where: { collectionId_savedItemId: { collectionId: collection.id, savedItemId: saved.id } },
        update: {},
        create: { collectionId: collection.id, savedItemId: saved.id },
      });
      await this.prisma.collection.update({
        where: { id: collection.id },
        data: { itemCount: await this.prisma.collectionItem.count({ where: { collectionId: collection.id } }) },
      });
    }

    // Sayğac — ekran 13-də "saxlanılıb" göstəricisi
    if (dto.type === 'place') {
      await this.prisma.place.update({ where: { id: target.id }, data: { saveCount: { increment: 1 } } });
    } else if (dto.type === 'route') {
      await this.prisma.route.update({ where: { id: target.id }, data: { saveCount: { increment: 1 } } });
    }

    return { saved: true, savedId: Number(saved.id) };
  }

  async unsave(userId: bigint, type: SavedItemType, target: string, lang: Lang) {
    const resolved = await this.resolve(type, target, lang);
    const existing = await this.prisma.savedItem.findUnique({
      where: { userId_targetType_targetId: { userId, targetType: type, targetId: resolved.id } },
    });
    if (!existing) return { saved: false };

    await this.prisma.savedItem.delete({ where: { id: existing.id } });

    if (type === 'place') {
      await this.prisma.place.update({ where: { id: resolved.id }, data: { saveCount: { decrement: 1 } } });
    } else if (type === 'route') {
      await this.prisma.route.update({ where: { id: resolved.id }, data: { saveCount: { decrement: 1 } } });
    }

    // Kolleksiya sayğaclarını düzəldirik
    const affected = await this.prisma.collection.findMany({ where: { userId }, select: { id: true } });
    for (const c of affected) {
      await this.prisma.collection.update({
        where: { id: c.id },
        data: { itemCount: await this.prisma.collectionItem.count({ where: { collectionId: c.id } }) },
      });
    }

    return { saved: false };
  }

  // ─────────────────── kolleksiyalar ───────────────────

  async collections(userId: bigint) {
    const rows = await this.prisma.collection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { cover: { select: { storageKey: true } } },
    });
    const total = await this.prisma.savedItem.count({ where: { userId } });

    return {
      all: { publicId: null, name: 'Hamısı', itemCount: total, isPrivate: false, coverUrl: null },
      collections: rows.map((c) => ({
        publicId: c.publicId,
        name: c.name,
        itemCount: c.itemCount,
        isPrivate: c.isPrivate,
        coverUrl: this.url(c.cover?.storageKey),
      })),
    };
  }

  async createCollection(userId: bigint, dto: CreateCollectionDto) {
    const existing = await this.prisma.collection.findFirst({ where: { userId, name: dto.name } });
    if (existing) {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: 'Bu adda kolleksiya artıq var' });
    }

    let coverId: bigint | null = null;
    if (dto.coverMediaPublicId) {
      const media = await this.prisma.mediaAsset.findUnique({ where: { publicId: dto.coverMediaPublicId } });
      if (!media || media.ownerId !== userId) {
        throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: 'Cover media tapılmadı' });
      }
      coverId = media.id;
    }

    const created = await this.prisma.collection.create({
      data: { publicId: ulid(), userId, name: dto.name, isPrivate: dto.isPrivate ?? false, coverId },
    });
    return { publicId: created.publicId, name: created.name, itemCount: 0, isPrivate: created.isPrivate };
  }

  async updateCollection(userId: bigint, publicId: string, dto: UpdateCollectionDto) {
    const collection = await this.prisma.collection.findFirst({ where: { publicId } });
    if (!collection) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Kolleksiya tapılmadı' });
    if (collection.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu kolleksiya sizə aid deyil' });
    }

    let coverId: bigint | undefined;
    if (dto.coverMediaPublicId) {
      const media = await this.prisma.mediaAsset.findUnique({ where: { publicId: dto.coverMediaPublicId } });
      if (!media || media.ownerId !== userId) {
        throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: 'Cover media tapılmadı' });
      }
      coverId = media.id;
    }

    const updated = await this.prisma.collection.update({
      where: { id: collection.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isPrivate !== undefined ? { isPrivate: dto.isPrivate } : {}),
        ...(coverId !== undefined ? { coverId } : {}),
      },
    });
    return { publicId: updated.publicId, name: updated.name, itemCount: updated.itemCount, isPrivate: updated.isPrivate };
  }

  async removeCollection(userId: bigint, publicId: string) {
    const collection = await this.prisma.collection.findFirst({ where: { publicId } });
    if (!collection) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Kolleksiya tapılmadı' });
    if (collection.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu kolleksiya sizə aid deyil' });
    }
    // Kolleksiya silinir, saxlanılan elementlər qalır — ekran 33-də "Hamısı"da görünür
    await this.prisma.collection.delete({ where: { id: collection.id } });
    return { deleted: true };
  }
}
