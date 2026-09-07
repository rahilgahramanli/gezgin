import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignResult {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
  expiresInS: number;
}

/**
 * Fayllar API-dən keçmir — mobil tərəf birbaşa S3-ə (dev: MinIO) yükləyir.
 * Axın: POST /media/presign → PUT uploadUrl → POST /media/:id/complete
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'gezgin';
    this.publicBase = this.config.get<string>('S3_PUBLIC_URL') ?? '';
    this.client = new S3Client({
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY') ?? '',
        secretAccessKey: this.config.get<string>('S3_SECRET_KEY') ?? '',
      },
    });
  }

  onModuleInit(): void {
    this.logger.log(`Obyekt anbarı: ${this.config.get<string>('S3_ENDPOINT')}/${this.bucket}`);
  }

  buildKey(ownerPublicId: string, folder: string, ext: string): string {
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    return `${folder}/${ownerPublicId}/${stamp}-${rand}.${ext}`;
  }

  async presignUpload(storageKey: string, contentType: string, expiresInS = 900): Promise<PresignResult> {
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, ContentType: contentType }),
      { expiresIn: expiresInS },
    );
    return { uploadUrl, storageKey, publicUrl: this.publicUrl(storageKey), expiresInS };
  }

  publicUrl(storageKey: string): string {
    return `${this.publicBase}/${storageKey}`;
  }

  /** Yükləmə həqiqətən baş verdimi — `complete` addımında yoxlanılır. */
  async headObject(storageKey: string): Promise<{ exists: boolean; sizeBytes: number; contentType?: string }> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }));
      return { exists: true, sizeBytes: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch {
      return { exists: false, sizeBytes: 0 };
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    } catch (e) {
      this.logger.warn(`Fayl silinmədi (${storageKey}): ${(e as Error).message}`);
    }
  }
}
