import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const REVIEW_TARGETS = ['place', 'route', 'experience', 'business', 'event'] as const;

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
