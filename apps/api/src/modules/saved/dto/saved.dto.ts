import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const SAVED_TYPES = ['place', 'route', 'experience', 'event', 'post', 'business'] as const;

export class ListSavedDto {
  @ApiPropertyOptional({ enum: SAVED_TYPES, description: 'Ekran 33 çipləri' })
  @IsOptional() @IsIn(SAVED_TYPES)
  type?: (typeof SAVED_TYPES)[number];

  @ApiPropertyOptional({ description: 'Kolleksiya publicId — ekran 33 kolleksiya seçicisi' })
  @IsOptional() @IsString() @MaxLength(26)
  collection?: string;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}

export class SaveItemDto {
  @ApiProperty({ enum: SAVED_TYPES })
  @IsIn(SAVED_TYPES)
  type!: (typeof SAVED_TYPES)[number];

  @ApiProperty({ description: 'Hədəfin slug-ı (post üçün publicId)' })
  @IsString() @MaxLength(120)
  target!: string;

  @ApiPropertyOptional({ description: 'Kolleksiyaya da əlavə et' })
  @IsOptional() @IsString() @MaxLength(26)
  collection?: string;
}

export class CreateCollectionDto {
  @ApiProperty({ example: 'Yay 2026' })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === true || value === 'true')
  isPrivate?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(26)
  coverMediaPublicId?: string;
}

export class UpdateCollectionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === true || value === 'true')
  isPrivate?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(26)
  coverMediaPublicId?: string;
}
