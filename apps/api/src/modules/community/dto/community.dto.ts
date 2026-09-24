import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Ekran 43 "Şikayət et" — moderasiya növbəsində (Sprint 10) bu kodlarla qruplaşdırılır. */
export const REPORT_REASONS = ['spam', 'inappropriate', 'harassment', 'false_info', 'copyright', 'other'] as const;

export class ReportDto {
  @ApiProperty({ enum: REPORT_REASONS })
  @IsIn(REPORT_REASONS)
  reason!: (typeof REPORT_REASONS)[number];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional() @IsString() @MaxLength(1000)
  details?: string;
}

export class ListNotificationsDto {
  @ApiPropertyOptional({ enum: ['all', 'social', 'system'], default: 'all' })
  @IsOptional() @IsIn(['all', 'social', 'system'])
  tab?: 'all' | 'social' | 'system';

  @ApiPropertyOptional({ description: 'Əvvəlki cavabdakı nextCursor' })
  @IsOptional() @IsString() @MaxLength(26)
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}
