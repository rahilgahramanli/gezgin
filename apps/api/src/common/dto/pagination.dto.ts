import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@gezgin/shared';

/** Cursor əsaslı səhifələmə — bütün siyahı endpointləri bunu istifadə edir. */
export class CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Əvvəlki cavabdakı nextCursor dəyəri' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: PAGE_SIZE_DEFAULT, maximum: PAGE_SIZE_MAX })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  limit: number = PAGE_SIZE_DEFAULT;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export function buildCursorPage<T extends { publicId: string }>(rows: T[], limit: number): CursorPage<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, nextCursor: hasMore ? data[data.length - 1].publicId : null };
}
