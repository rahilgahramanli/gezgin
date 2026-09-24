import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStoryDto {
  @ApiProperty({ description: 'Media publicId — əvvəlcə /media/presign + /complete' })
  @IsString() @MaxLength(26)
  media!: string;

  @ApiPropertyOptional({ maxLength: 255, example: 'Zirvədə gün doğuşu ☀️' })
  @IsOptional() @IsString() @MaxLength(255)
  caption?: string;

  @ApiPropertyOptional({ description: 'Məkan slug — ekran 40 "Şahdağ, Qusar"' })
  @IsOptional() @IsString() @MaxLength(120)
  place?: string;
}
