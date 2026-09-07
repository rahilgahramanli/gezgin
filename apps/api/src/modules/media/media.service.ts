import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { ERROR_CODES, MEDIA } from '@gezgin/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import type { CompleteUploadDto, PresignDto } from './dto/media.dto';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
};

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Addım 1: yükləmə linki. Fayl API-dən keçmir. */
  async presign(user: { id: bigint; publicId: string }, dto: PresignDto) {
    const isVideo = dto.contentType.startsWith('video/');
    const limit = isVideo ? MEDIA.videoMaxBytes : MEDIA.imageMaxBytes;
    if (dto.sizeBytes > limit) {
      throw new BadRequestException({
        code: ERROR_CODES.UPLOAD_TOO_LARGE,
        message: `Fayl həddi aşır: maksimum ${Math.round(limit / 1024 / 1024)} MB`,
      });
    }

    const storageKey = this.storage.buildKey(user.publicId, dto.folder, EXT[dto.contentType] ?? 'bin');
    const presigned = await this.storage.presignUpload(storageKey, dto.contentType);

    const media = await this.prisma.mediaAsset.create({
      data: {
        publicId: ulid(),
        ownerId: user.id,
        type: isVideo ? 'video' : 'image',
        status: 'pending',
        storageKey,
        mimeType: dto.contentType,
        sizeBytes: dto.sizeBytes,
      },
    });

    return {
      mediaPublicId: media.publicId,
      uploadUrl: presigned.uploadUrl,
      expiresInS: presigned.expiresInS,
      publicUrl: presigned.publicUrl,
    };
  }

  /** Addım 2: yükləmənin təsdiqi — obyektin həqiqətən mövcudluğu yoxlanılır. */
  async complete(userId: bigint, publicId: string, dto: CompleteUploadDto) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { publicId } });
    if (!media) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Media tapılmadı' });
    if (media.ownerId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu media sizə aid deyil' });
    }

    const head = await this.storage.headObject(media.storageKey);
    if (!head.exists) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Fayl anbarda tapılmadı — yükləmə tamamlanmayıb',
      });
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id: media.id },
      data: {
        status: 'ready',
        sizeBytes: head.sizeBytes,
        width: dto.width ?? null,
        height: dto.height ?? null,
        durationS: dto.durationS ?? null,
        blurhash: dto.blurhash ?? null,
        altText: dto.altText ?? null,
        // Ölçü variantları Sprint 7-də `media` queue-si tərəfindən yaradılacaq
      },
    });

    return {
      publicId: updated.publicId,
      url: this.storage.publicUrl(updated.storageKey),
      type: updated.type,
      sizeBytes: updated.sizeBytes,
      width: updated.width,
      height: updated.height,
      blurhash: updated.blurhash,
    };
  }

  async get(publicId: string) {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { publicId, deletedAt: null, status: 'ready' },
    });
    if (!media) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Media tapılmadı' });
    return {
      publicId: media.publicId,
      url: this.storage.publicUrl(media.storageKey),
      type: media.type,
      width: media.width,
      height: media.height,
      blurhash: media.blurhash,
      altText: media.altText,
    };
  }

  async remove(userId: bigint, publicId: string) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { publicId } });
    if (!media) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Media tapılmadı' });
    if (media.ownerId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Bu media sizə aid deyil' });
    }
    await this.prisma.mediaAsset.update({ where: { id: media.id }, data: { deletedAt: new Date() } });
    await this.storage.deleteObject(media.storageKey);
    return { deleted: true };
  }
}
