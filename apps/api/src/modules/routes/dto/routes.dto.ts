import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional,
  IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

const csv = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value;

export const DIFFICULTIES = ['asan', 'orta', 'cetin'] as const;

export class ListRoutesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  q?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  region?: string;

  @ApiPropertyOptional({ description: 'Müddət filtri — ekran 14: 1, 2-3, 7+', example: '2-3' })
  @IsOptional() @IsString() @Matches(/^\d+(-\d+)?\+?$/, { message: 'Format: 1, 2-3 və ya 7+' })
  duration?: string;

  @ApiPropertyOptional({ enum: DIFFICULTIES })
  @IsOptional() @IsIn(DIFFICULTIES)
  difficulty?: (typeof DIFFICULTIES)[number];

  @ApiPropertyOptional({ example: 'tebiet,macera' })
  @IsOptional() @Transform(csv) @IsArray() @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ enum: ['popular', 'rating', 'newest', 'shortest'], default: 'popular' })
  @IsOptional() @IsIn(['popular', 'rating', 'newest', 'shortest'])
  sort?: 'popular' | 'rating' | 'newest' | 'shortest';

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}

export class CreateRouteDto {
  @ApiProperty({ example: 'Quba həftəsonu marşrutu' })
  @IsString() @MinLength(3) @MaxLength(160)
  title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Region slug' })
  @IsString() @MaxLength(80)
  region!: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30)
  days?: number = 1;

  @ApiPropertyOptional({ enum: DIFFICULTIES, default: 'asan' })
  @IsOptional() @IsIn(DIFFICULTIES)
  difficulty?: (typeof DIFFICULTIES)[number];

  @ApiPropertyOptional({ example: ['tebiet', 'macera'] })
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ description: 'İctimai paylaş — ekran 50 toggle', default: false })
  @IsOptional() @Transform(({ value }) => value === true || value === 'true')
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Cover media publicId' })
  @IsOptional() @IsString() @MaxLength(26)
  coverMediaPublicId?: string;
}

export class UpdateRouteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30)
  days?: number;

  @ApiPropertyOptional({ enum: DIFFICULTIES }) @IsOptional() @IsIn(DIFFICULTIES)
  difficulty?: (typeof DIFFICULTIES)[number];

  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === true || value === 'true')
  isPublic?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(26)
  coverMediaPublicId?: string;
}

export class AddStopDto {
  @ApiProperty({ description: 'Məkan slug' })
  @IsString() @MaxLength(120)
  place!: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30)
  day?: number = 1;

  @ApiPropertyOptional({ description: 'Sıra — verilməzsə sona əlavə olunur' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Format: HH:MM' })
  arriveTime?: string;

  @ApiPropertyOptional({ description: 'Dəqiqə' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1440)
  durationMin?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class UpdateStopDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30)
  day?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  arriveTime?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1440)
  durationMin?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class ReorderStopItem {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  stopId!: number;

  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(30)
  day!: number;

  @ApiProperty() @Type(() => Number) @IsInt() @Min(0)
  order!: number;
}

export class ReorderStopsDto {
  @ApiProperty({ type: [ReorderStopItem] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => ReorderStopItem)
  stops!: ReorderStopItem[];
}
