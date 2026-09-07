import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@gezgin/shared';

const csv = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value;

export class ListPlacesDto {
  @ApiPropertyOptional({ description: 'Axtarış sözü — ekran 12 axtarış sahəsi' })
  @IsOptional() @IsString() @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: 'Region slug' })
  @IsOptional() @IsString() @MaxLength(80)
  region?: string;

  @ApiPropertyOptional({ description: 'Kateqoriya slug-ları, vergüllə — ekran 45', example: 'tebiet,medeniyyet' })
  @IsOptional() @Transform(csv) @IsArray() @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ description: 'Yaxınlıq mərkəzi' })
  @IsOptional() @Type(() => Number) @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Radius km — ekran 45 slayderi', default: 25 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(500)
  radiusKm?: number;

  @ApiPropertyOptional({ description: 'Minimal reytinq — ekran 45', example: 4.5 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Qiymət səviyyəsi: 0 pulsuz, 1 ₼, 2 ₼₼, 3 ₼₼₼' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3)
  priceLevel?: number;

  @ApiPropertyOptional({ enum: ['popular', 'rating', 'distance', 'newest'], default: 'popular' })
  @IsOptional() @IsIn(['popular', 'rating', 'distance', 'newest'])
  sort?: 'popular' | 'rating' | 'distance' | 'newest';

  @ApiPropertyOptional({ description: 'Yalnız seçilmişlər' })
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true)
  featured?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ default: PAGE_SIZE_DEFAULT, maximum: PAGE_SIZE_MAX })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(PAGE_SIZE_MAX)
  limit?: number = PAGE_SIZE_DEFAULT;
}

export class MapPlacesDto {
  @ApiPropertyOptional({ description: 'Görünüş sərhədi: minLng,minLat,maxLng,maxLat', example: '47.9,41.1,48.6,41.5' })
  @IsOptional() @IsString()
  bbox?: string;

  @ApiPropertyOptional({ description: 'Xəritə zoom səviyyəsi — klasterləmə dəqiqliyini müəyyən edir', default: 10 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20)
  zoom?: number = 10;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  region?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(csv) @IsArray() @IsString({ each: true })
  categories?: string[];
}

export class NearbyDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(200)
  radiusKm?: number = 20;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30)
  limit?: number = 10;
}

export class AddPlacePhotoDto {
  @ApiPropertyOptional({ description: 'POST /media/:id/complete-dən gələn publicId' })
  @IsString() @MaxLength(26)
  mediaPublicId!: string;
}

export class ReportPlaceDto {
  @ApiPropertyOptional({ enum: ['wrong_info', 'closed', 'duplicate', 'inappropriate', 'other'] })
  @IsIn(['wrong_info', 'closed', 'duplicate', 'inappropriate', 'other'])
  reason!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional() @IsString() @MaxLength(1000)
  details?: string;
}
