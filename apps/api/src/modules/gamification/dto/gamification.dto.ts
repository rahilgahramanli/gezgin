import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CheckinDto {
  @ApiProperty({ description: 'Məkan slug' })
  @IsString() @MaxLength(120)
  place!: string;

  @ApiPropertyOptional({ description: 'Cari mövqe — məsafə yoxlaması üçün' })
  @IsOptional() @Type(() => Number) @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Aktiv səyahət publicId — plan elementi tamamlandı işarələnir' })
  @IsOptional() @IsString() @MaxLength(26)
  trip?: string;
}

export class LeaderboardDto {
  @ApiPropertyOptional({ enum: ['weekly', 'monthly', 'all_time'], default: 'weekly' })
  @IsOptional() @IsIn(['weekly', 'monthly', 'all_time'])
  period?: 'weekly' | 'monthly' | 'all_time';

  @ApiPropertyOptional({ description: 'Region slug — ekran 31 region çipi' })
  @IsOptional() @IsString() @MaxLength(80)
  region?: string;

  @ApiPropertyOptional({ description: 'Yalnız izlədiklərim — ekran 31 "Dostlarım"' })
  @IsOptional() @IsIn(['true', 'false'])
  following?: string;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(3) @Max(100)
  limit?: number = 20;
}
