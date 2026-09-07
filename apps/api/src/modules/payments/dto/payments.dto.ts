import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AddPaymentMethodDto {
  @ApiProperty({ description: 'Kart nömrəsi — saxlanılmır, yalnız tokenləşdirilir', example: '4111111111111111' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '') : value))
  @IsString() @Matches(/^\d{13,19}$/, { message: 'Kart nömrəsi 13–19 rəqəm olmalıdır' })
  number!: string;

  @ApiProperty({ example: 12 })
  @Type(() => Number) @IsInt() @Min(1) @Max(12)
  expMonth!: number;

  @ApiProperty({ example: 2029 })
  @Type(() => Number) @IsInt() @Min(2024) @Max(2099)
  expYear!: number;

  @ApiProperty({ example: '123' })
  @IsString() @Matches(/^\d{3,4}$/, { message: 'CVV 3–4 rəqəm olmalıdır' })
  cvv!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  holderName?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

export class RefundDto {
  @ApiPropertyOptional({ description: 'Qismən geri qaytarma — verilməzsə tam məbləğ' })
  @IsOptional() @Type(() => Number) @Min(0.01)
  amountAzn?: number;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional() @IsString() @MaxLength(255)
  reason?: string;
}
