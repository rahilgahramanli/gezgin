import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsISO8601, IsNumber, IsOptional,
  IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';

const csv = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value;

export const DURATIONS = ['two_hours', 'half_day', 'full_day', 'multi_day'] as const;

export class ListExperiencesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  q?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  region?: string;

  @ApiPropertyOptional({ example: 'qastronomiya,macera' })
  @IsOptional() @Transform(csv) @IsArray() @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ enum: DURATIONS }) @IsOptional() @IsIn(DURATIONS)
  duration?: (typeof DURATIONS)[number];

  @ApiPropertyOptional({ description: 'Maksimum qiymət (AZN)' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10000)
  maxPrice?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Local Expert istifadəçi adı' })
  @IsOptional() @IsString() @MaxLength(32)
  expert?: string;

  @ApiPropertyOptional({ enum: ['popular', 'rating', 'price_asc', 'price_desc', 'newest'], default: 'popular' })
  @IsOptional() @IsIn(['popular', 'rating', 'price_asc', 'price_desc', 'newest'])
  sort?: 'popular' | 'rating' | 'price_asc' | 'price_desc' | 'newest';

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}

export class CreateExperienceDto {
  @ApiProperty({ example: 'Kənd mətbəxi masterklassı' })
  @IsString() @MinLength(3) @MaxLength(160)
  title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000)
  description?: string;

  @ApiProperty({ description: 'Region slug' })
  @IsString() @MaxLength(80)
  region!: string;

  @ApiPropertyOptional({ description: 'Məkan slug — varsa' })
  @IsOptional() @IsString() @MaxLength(120)
  place?: string;

  @ApiPropertyOptional({ description: 'Kateqoriya slug' })
  @IsOptional() @IsString() @MaxLength(60)
  category?: string;

  @ApiProperty({ enum: DURATIONS, default: 'half_day' })
  @IsIn(DURATIONS)
  duration!: (typeof DURATIONS)[number];

  @ApiProperty({ description: 'Nəfər başına AZN', example: 60 })
  @Type(() => Number) @IsNumber() @Min(0) @Max(10000)
  priceAzn!: number;

  @ApiPropertyOptional({ default: 10 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  maxGroup?: number;

  @ApiPropertyOptional({ description: 'Qiymətə daxildir — ekran 56', example: ['beledci', 'yerli-nahar'] })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true })
  includes?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  meetingPoint?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  lat?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  lng?: number;

  @ApiPropertyOptional({ description: 'Media publicId siyahısı — birincisi cover' })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true })
  photoMediaPublicIds?: string[];
}

export class UpdateExperienceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000)
  description?: string;

  @ApiPropertyOptional({ enum: DURATIONS }) @IsOptional() @IsIn(DURATIONS)
  duration?: (typeof DURATIONS)[number];

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10000)
  priceAzn?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  maxGroup?: number;

  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true })
  includes?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  meetingPoint?: string;

  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true })
  photoMediaPublicIds?: string[];
}

export class CreateSlotsDto {
  @ApiProperty({ description: 'ISO tarix-saat siyahısı', example: ['2026-09-15T09:00:00Z'] })
  @IsArray() @ArrayMaxSize(60) @IsISO8601({}, { each: true })
  startAt!: string[];

  @ApiPropertyOptional({ description: 'Yer sayı — verilməzsə təcrübənin maxGroup dəyəri' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  capacity?: number;
}

export class AvailabilityDto {
  @ApiPropertyOptional({ description: 'Başlanğıc tarix (YYYY-MM-DD)' })
  @IsOptional() @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Neçə gün irəli', default: 30 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(180)
  days?: number = 30;
}
