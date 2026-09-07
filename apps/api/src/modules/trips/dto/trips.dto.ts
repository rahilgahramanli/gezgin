import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601,
  IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export const TRIP_ITEM_TYPES = ['place', 'experience', 'event', 'custom'] as const;
export const TRIP_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;

export class ListTripsDto {
  @ApiPropertyOptional({ enum: [...TRIP_STATUSES, 'upcoming', 'past'] })
  @IsOptional() @IsIn([...TRIP_STATUSES, 'upcoming', 'past'])
  status?: string;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}

export class CreateTripDto {
  @ApiProperty({ example: 'Qəbələ yay səyahəti' })
  @IsString() @MinLength(2) @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ description: 'Hazır marşrutdan başla — ekran 24' })
  @IsOptional() @IsString() @MaxLength(120)
  fromRoute?: string;

  @ApiPropertyOptional({ example: '2026-07-05' })
  @IsOptional() @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-07-08' })
  @IsOptional() @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ default: 1, description: 'Nəfər sayı — ekran 24' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  travelers?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(26)
  coverMediaPublicId?: string;

  @ApiPropertyOptional({ description: 'Offline xəritə yüklə — ekran 24 toggle' })
  @IsOptional() @Transform(({ value }) => value === true || value === 'true')
  offlineEnabled?: boolean;
}

export class UpdateTripDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(160)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  travelers?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(26)
  coverMediaPublicId?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === true || value === 'true')
  offlineEnabled?: boolean;
}

/** Ekran 48 — "Plana əlavə et" paneli. */
export class AddTripItemDto {
  @ApiProperty({ enum: TRIP_ITEM_TYPES })
  @IsIn(TRIP_ITEM_TYPES)
  type!: (typeof TRIP_ITEM_TYPES)[number];

  @ApiPropertyOptional({ description: 'place / experience / event üçün slug' })
  @IsOptional() @IsString() @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional({ description: 'type=custom üçün sərbəst ad' })
  @IsOptional() @IsString() @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60)
  day?: number = 1;

  @ApiPropertyOptional({ example: '15:00' })
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Format: HH:MM' })
  startTime?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1440)
  durationMin?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class UpdateTripItemDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60)
  day?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1440)
  durationMin?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: 'Tamamlandı işarəsi — ekran 23' })
  @IsOptional() @IsBoolean()
  isDone?: boolean;
}

export class ReorderTripItem {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  itemId!: number;

  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(60)
  day!: number;

  @ApiProperty() @Type(() => Number) @IsInt() @Min(0)
  order!: number;
}

export class ReorderTripItemsDto {
  @ApiProperty({ type: [ReorderTripItem] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(300)
  @ValidateNested({ each: true }) @Type(() => ReorderTripItem)
  items!: ReorderTripItem[];
}

export class AddDayDto {
  @ApiPropertyOptional({ description: 'Günün başlığı' })
  @IsOptional() @IsString() @MaxLength(160)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsISO8601()
  date?: string;
}

export class AddNoteDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString() @MinLength(1) @MaxLength(4000)
  body!: string;
}
