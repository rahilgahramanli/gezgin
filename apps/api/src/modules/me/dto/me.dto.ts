import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional,
  IsString, Matches, MaxLength, MinLength,
} from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Latın hərfləri, rəqəm, nöqtə, alt xətt' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9._]{3,32}$/, { message: 'İstifadəçi adı 3–32 simvol: a-z, 0-9, nöqtə, alt xətt' })
  username?: string;

  @ApiPropertyOptional({ maxLength: 300 }) @IsOptional() @IsString() @MaxLength(300)
  bio?: string;

  @ApiPropertyOptional({ enum: ['female', 'male', 'other', 'unspecified'] })
  @IsOptional() @IsIn(['female', 'male', 'other', 'unspecified'])
  gender?: 'female' | 'male' | 'other' | 'unspecified';

  @ApiPropertyOptional({ example: '1996-03-12' }) @IsOptional() @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Region slug — ekran 04, 54. `null` və ya boş sətir ev regionunu götürür', nullable: true })
  @IsOptional() @IsString() @MaxLength(80)
  homeRegionSlug?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isPublic?: boolean;
}

export class SetInterestsDto {
  @ApiProperty({ type: [String], example: ['tebiet', 'macera', 'qastronomiya'] })
  @IsArray() @ArrayMinSize(1, { message: 'Ən azı 1 maraq seçin' }) @ArrayMaxSize(20)
  @IsString({ each: true })
  @Type(() => String)
  slugs!: string[];
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ['az', 'en', 'ru'] }) @IsOptional() @IsIn(['az', 'en', 'ru'])
  language?: 'az' | 'en' | 'ru';

  @ApiPropertyOptional() @IsOptional() @IsBoolean() darkMode?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pushEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() locationEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() wifiOnlyDownload?: boolean;

  @ApiPropertyOptional({ enum: ['public', 'followers', 'private'] })
  @IsOptional() @IsIn(['public', 'followers', 'private'])
  profileVisibility?: 'public' | 'followers' | 'private';
}

export class SetProfileMediaDto {
  @ApiProperty({ description: 'POST /media/:id/complete-dən gələn media publicId' })
  @IsString() @MinLength(26) @MaxLength(26)
  mediaPublicId!: string;
}

export class BlockUserDto {
  @ApiPropertyOptional({ maxLength: 255 }) @IsOptional() @IsString() @MaxLength(255)
  reason?: string;
}
