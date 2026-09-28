import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ERROR_CODES, tierForLevel } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { currentLang, tierName, type Lang } from '@/common/i18n';
import { StorageService } from '@/modules/storage/storage.service';

/** İstifadəçi kartı üçün minimal sahələr — lent, şərh, izləyici siyahısı, çat. */
export const USER_CARD_SELECT = {
  id: true,
  publicId: true,
  username: true,
  fullName: true,
  level: true,
  role: true,
  isVerified: true,
  avatar: { select: { storageKey: true } },
} satisfies Prisma.UserSelect;

export type UserCardRow = Prisma.UserGetPayload<{ select: typeof USER_CARD_SELECT }>;

export interface UserCard {
  username: string;
  fullName: string;
  avatarUrl: string | null;
  level: number;
  tier: string;
  role: string;
  isLocalExpert: boolean;
  isVerified: boolean;
}

/**
 * Sosial qraf — izləmə, bloklama və istifadəçi kartı.
 *
 * Bloklama hər iki istiqamətdə gizlədir: A B-ni bloklayıbsa, nə A B-nin,
 * nə də B A-nın kontentini lentdə, şərhlərdə və çatda görmür.
 */
@Injectable()
export class SocialGraphService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  url(key?: string | null): string | null {
    return key ? this.storage.publicUrl(key) : null;
  }

  /** `lang` yalnız sorğudan kənar göndərişdə (canlı bildiriş) verilir — defolt sorğunun dilidir. */
  card(u: UserCardRow, lang: Lang = currentLang()): UserCard {
    return {
      username: u.username,
      fullName: u.fullName,
      avatarUrl: this.url(u.avatar?.storageKey),
      level: u.level,
      tier: tierName(tierForLevel(u.level), lang),
      role: u.role,
      isLocalExpert: u.role === 'local_expert',
      isVerified: u.isVerified,
    };
  }

  /** Aktiv istifadəçi. Silinmiş hesab da, bloklama əlaqəsi olan hesab da 404-dür — mövcudluğu açıqlanmır. */
  async findActive(username: string, viewerId?: bigint) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null, status: 'active' },
      select: { ...USER_CARD_SELECT, isPublic: true },
    });
    if (!user || (viewerId !== undefined && viewerId !== user.id && (await this.isBlockedBetween(viewerId, user.id)))) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'İstifadəçi tapılmadı' });
    }
    return user;
  }

  /** Hər iki istiqamətdə bloklama əlaqəsi olan istifadəçilər. */
  async hiddenUserIds(viewerId?: bigint): Promise<bigint[]> {
    if (viewerId === undefined) return [];
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    });
    return rows.map((r) => (r.blockerId === viewerId ? r.blockedId : r.blockerId));
  }

  async followingIds(viewerId?: bigint): Promise<bigint[]> {
    if (viewerId === undefined) return [];
    const rows = await this.prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
    return rows.map((r) => r.followingId);
  }

  async isBlockedBetween(a: bigint, b: bigint): Promise<boolean> {
    const count = await this.prisma.block.count({
      where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    });
    return count > 0;
  }

  async isFollowing(followerId: bigint, followingId: bigint): Promise<boolean> {
    const row = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
      select: { followerId: true },
    });
    return row !== null;
  }
}
