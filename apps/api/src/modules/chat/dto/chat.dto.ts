import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** `booking_card` və `system` yalnız server tərəfindən yaradılır. */
export const SENDABLE_MESSAGE_TYPES = ['text', 'image', 'experience_card', 'route_card'] as const;
export const CONVERSATION_FILTERS = ['all', 'experts', 'business', 'travelers'] as const;

export class OpenConversationDto {
  @ApiProperty({ description: 'Qarşı tərəfin istifadəçi adı' })
  @IsString() @MaxLength(32)
  username!: string;
}

export class ListConversationsDto {
  @ApiPropertyOptional({ enum: CONVERSATION_FILTERS, default: 'all', description: 'Ekran 08 çipləri' })
  @IsOptional() @IsIn(CONVERSATION_FILTERS)
  filter?: (typeof CONVERSATION_FILTERS)[number];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 30;
}

export class MessagesQueryDto {
  @ApiPropertyOptional({ description: 'Bu mesajdan köhnələri — əvvəlki cavabdakı nextCursor' })
  @IsOptional() @IsString() @MaxLength(26)
  before?: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 30;
}

export class SendMessageDto {
  @ApiPropertyOptional({ enum: SENDABLE_MESSAGE_TYPES, default: 'text' })
  @IsOptional() @IsIn(SENDABLE_MESSAGE_TYPES)
  type?: (typeof SENDABLE_MESSAGE_TYPES)[number];

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional() @IsString() @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional({ description: '`image` üçün media publicId' })
  @IsOptional() @IsString() @MaxLength(26)
  media?: string;

  @ApiPropertyOptional({ description: '`experience_card` / `route_card` üçün slug — ekran 09 təcrübə kartı' })
  @IsOptional() @IsString() @MaxLength(120)
  target?: string;
}
