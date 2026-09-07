import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MEDIA } from '@gezgin/shared';

export class PresignDto {
  @ApiProperty({ enum: [...MEDIA.imageMime, ...MEDIA.videoMime] })
  @IsString()
  @IsIn([...MEDIA.imageMime, ...MEDIA.videoMime], { message: 'Bu fayl növü dəstəklənmir' })
  contentType!: string;

  @ApiProperty({ description: 'Baytla — limit yoxlanılır', example: 2_400_000 })
  @Type(() => Number) @IsInt() @Min(1) @Max(MEDIA.videoMaxBytes)
  sizeBytes!: number;

  @ApiProperty({ enum: ['avatar', 'cover', 'post', 'review', 'place', 'experience', 'document'] })
  @IsIn(['avatar', 'cover', 'post', 'review', 'place', 'experience', 'document'])
  folder!: string;
}

export class CompleteUploadDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  width?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  height?: number;

  @ApiPropertyOptional({ description: 'Video üçün saniyə' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3600)
  durationS?: number;

  @ApiPropertyOptional({ description: 'Yüklənmə anına qədər göstərilən placeholder' })
  @IsOptional() @IsString() @MaxLength(60)
  blurhash?: string;

  @ApiPropertyOptional({ description: 'Əlçatanlıq üçün təsvir' })
  @IsOptional() @IsString() @MaxLength(255)
  altText?: string;
}
