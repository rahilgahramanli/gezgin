import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export const FEED_TABS = ['for_you', 'following', 'nearby'] as const;
export const POST_VISIBILITY = ['public', 'followers', 'private'] as const;

export class FeedDto {
  @ApiPropertyOptional({ enum: FEED_TABS, default: 'for_you' })
  @IsOptional() @IsIn(FEED_TABS)
  tab?: (typeof FEED_TABS)[number] = 'for_you';

  @ApiPropertyOptional({ description: 'Nearby tabı üçün məcburi' })
  @IsOptional() @Type(() => Number) @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Nearby tabı üçün məcburi' })
  @IsOptional() @Type(() => Number) @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(300)
  radiusKm?: number = 50;

  @ApiPropertyOptional({ description: 'Əvvəlki cavabdakı nextCursor' })
  @IsOptional() @IsString() @MaxLength(26)
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}

export class CreatePostDto {
  @ApiPropertyOptional({ maxLength: 2200, example: 'Unudulmaz bir gün! 🏔️ #gezgin #xinaliq' })
  @IsOptional() @IsString() @MaxLength(2200)
  body?: string;

  @ApiPropertyOptional({ description: 'Media publicId-ləri — əvvəlcə /media/presign + /complete', type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(26, { each: true })
  media?: string[];

  @ApiPropertyOptional({ description: 'Məkan slug — ekran 26 "Yerləşmə"' })
  @IsOptional() @IsString() @MaxLength(120)
  place?: string;

  @ApiPropertyOptional({ description: 'Marşrut slug — ekran 26 "Marşruta bağla"' })
  @IsOptional() @IsString() @MaxLength(120)
  route?: string;

  @ApiPropertyOptional({ enum: POST_VISIBILITY, default: 'public' })
  @IsOptional() @IsIn(POST_VISIBILITY)
  visibility?: (typeof POST_VISIBILITY)[number];

  @ApiPropertyOptional({ description: 'Verilməzsə məkanın koordinatı götürülür' })
  @IsOptional() @Type(() => Number) @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsLongitude()
  lng?: number;
}

export class UpdatePostDto {
  @ApiPropertyOptional({ maxLength: 2200 })
  @IsOptional() @IsString() @MaxLength(2200)
  body?: string;

  @ApiPropertyOptional({ enum: POST_VISIBILITY })
  @IsOptional() @IsIn(POST_VISIBILITY)
  visibility?: (typeof POST_VISIBILITY)[number];

  @ApiPropertyOptional({ description: 'Məkan slug — boş sətir məkanı götürür' })
  @IsOptional() @IsString() @MaxLength(120)
  place?: string;
}

export class CommentsQueryDto {
  @ApiPropertyOptional({ description: 'Əvvəlki cavabdakı nextCursor' })
  @IsOptional() @IsString() @MaxLength(26)
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}

export class CreateCommentDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString() @MinLength(1) @MaxLength(1000)
  body!: string;

  @ApiPropertyOptional({ description: 'Cavab verilən şərhin publicId-si — ekran 06 "Cavab yaz"' })
  @IsOptional() @IsString() @MaxLength(26)
  parent?: string;
}
