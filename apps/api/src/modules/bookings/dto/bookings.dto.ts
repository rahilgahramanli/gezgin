import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BOOKING_EXTRAS } from '@gezgin/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';

export const BOOKING_TYPES = ['experience', 'business_package'] as const;

/**
 * Ekran 18 və 49 "Əlavə xidmətlər" — qiymətlər AZN.
 * Kataloq `@gezgin/shared`-dədir ki, mobil ekran seçimdən əvvəl də
 * eyni qiyməti göstərsin (əks halda iki yerdə saxlanıb bir-birindən uzaqlaşır).
 */
export const EXTRAS: Record<string, { nameAz: string; priceAzn: number }> = BOOKING_EXTRAS;

export class QuoteDto {
  @ApiProperty({ enum: BOOKING_TYPES })
  @IsIn(BOOKING_TYPES)
  type!: (typeof BOOKING_TYPES)[number];

  @ApiProperty({ description: 'Təcrübə və ya biznes paketi slug/publicId' })
  @IsString() @MaxLength(120)
  target!: string;

  @ApiPropertyOptional({ description: 'Təcrübə üçün slot ID' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  slotId?: number;

  @ApiPropertyOptional({ description: 'Otel üçün giriş tarixi — ekran 49' })
  @IsOptional() @IsISO8601()
  startAt?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  adults?: number = 1;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20)
  children?: number = 0;

  @ApiPropertyOptional({ description: 'Əlavə xidmətlər', example: ['transfer'] })
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true })
  extras?: string[];
}

export class CreateBookingDto extends QuoteDto {
  @ApiPropertyOptional({ description: 'Ödəniş üsulu publicId — verilməzsə sonra ödənilir' })
  @IsOptional() @IsString() @MaxLength(26)
  paymentMethod?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: 'Səyahət publicId — rezervasiya plana əlavə olunur' })
  @IsOptional() @IsString() @MaxLength(26)
  trip?: string;
}

export class ListBookingsDto {
  @ApiPropertyOptional({ enum: ['upcoming', 'past', 'cancelled'], default: 'upcoming' })
  @IsOptional() @IsIn(['upcoming', 'past', 'cancelled'])
  filter?: 'upcoming' | 'past' | 'cancelled';

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}

export class PayBookingDto {
  @ApiProperty({ description: 'Ödəniş üsulu publicId' })
  @IsString() @MaxLength(26)
  paymentMethod!: string;

  @ApiPropertyOptional({ description: '3-D Secure təsdiq kodu (mock: 123456)' })
  @IsOptional() @IsString() @MaxLength(10)
  otp?: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional() @IsString() @MaxLength(255)
  reason?: string;
}
