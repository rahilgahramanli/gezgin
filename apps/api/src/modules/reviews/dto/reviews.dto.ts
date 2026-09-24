import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { REVIEW_TAGS } from '@gezgin/shared';

export const REVIEW_TARGETS = ['place', 'route', 'experience', 'business', 'event'] as const;
const TAG_SLUGS = Object.keys(REVIEW_TAGS);

export class ListReviewsDto {
  @ApiProperty({ enum: REVIEW_TARGETS })
  @IsIn(REVIEW_TARGETS)
  targetType!: (typeof REVIEW_TARGETS)[number];

  @ApiProperty({ description: 'Hədəfin slug-ı' })
  @IsString() @MaxLength(120)
  target!: string;

  @ApiPropertyOptional({ enum: ['newest', 'highest', 'lowest', 'helpful'], default: 'newest' })
  @IsOptional() @IsIn(['newest', 'highest', 'lowest', 'helpful'])
  sort?: 'newest' | 'highest' | 'lowest' | 'helpful';

  @ApiPropertyOptional({ description: 'Yalnız fotolu rəylər' })
  @IsOptional() @IsIn(['true', 'false'])
  withPhotos?: string;

  @ApiPropertyOptional({ description: 'Minimal ulduz' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  rating?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}

export class ReviewSummaryDto {
  @ApiProperty({ enum: REVIEW_TARGETS })
  @IsIn(REVIEW_TARGETS)
  targetType!: (typeof REVIEW_TARGETS)[number];

  @ApiProperty()
  @IsString() @MaxLength(120)
  target!: string;
}

/** Ekran 27 — rəy yaz. */
export class CreateReviewDto {
  @ApiProperty({ enum: REVIEW_TARGETS })
  @IsIn(REVIEW_TARGETS)
  targetType!: (typeof REVIEW_TARGETS)[number];

  @ApiProperty({ description: 'Hədəfin slug-ı' })
  @IsString() @MaxLength(120)
  target!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 500, description: 'Ekran 27 "112 / 500"' })
  @IsOptional() @IsString() @MaxLength(500)
  body?: string;

  @ApiPropertyOptional({ enum: TAG_SLUGS, isArray: true, description: '"Səyahətin necə keçdi?" çipləri' })
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsIn(TAG_SLUGS, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Foto media publicId-ləri', type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) @MaxLength(26, { each: true })
  photos?: string[];
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  rating?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500)
  body?: string;

  @ApiPropertyOptional({ enum: TAG_SLUGS, isArray: true })
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsIn(TAG_SLUGS, { each: true })
  tags?: string[];
}
