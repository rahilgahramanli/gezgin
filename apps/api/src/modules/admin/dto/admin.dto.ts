import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'rejected'] as const;
export const USER_STATUSES = ['active', 'suspended', 'deleted'] as const;

/** Moderasiya növbəsində mümkün qərarlar — hamısı `AuditLog`-a yazılır. */
export const REPORT_ACTIONS = ['dismiss', 'delete_content', 'suspend_user'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

/** Admin özü silə bildiyi kontent növləri. */
export const CONTENT_TYPES = ['post', 'comment', 'review', 'story'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export class ReportQueueDto {
  @ApiPropertyOptional({ enum: REPORT_STATUSES, default: 'open' })
  @IsOptional() @IsIn(REPORT_STATUSES)
  status?: (typeof REPORT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Son sətrin publicId-si' })
  @IsOptional() @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number;
}

export class ResolveReportDto {
  @ApiProperty({ enum: REPORT_ACTIONS })
  @IsIn(REPORT_ACTIONS)
  action!: ReportAction;

  @ApiPropertyOptional({ description: 'Qərarın səbəbi — audit izində saxlanılır' })
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class UserSearchDto {
  @ApiPropertyOptional({ description: 'Ad, istifadəçi adı və ya e-mail' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional() @IsIn(USER_STATUSES)
  status?: (typeof USER_STATUSES)[number];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number;
}

export class SuspendUserDto {
  @ApiProperty({ description: 'İstifadəçiyə göstərilməyən daxili səbəb' })
  @IsString() @MinLength(3) @MaxLength(300)
  reason!: string;
}

export class AuditQueryDto {
  @ApiPropertyOptional({ description: 'Yalnız bu admin-in əməliyyatları (username)' })
  @IsOptional() @IsString()
  actor?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
