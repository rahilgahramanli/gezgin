import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UserPostsDto {
  @ApiPropertyOptional({ description: 'Əvvəlki cavabdakı nextCursor' })
  @IsOptional() @IsString() @MaxLength(26)
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}

/** İzləyici siyahıları `follows` cədvəlindədir — publicId yoxdur, ona görə offset. */
export class UserListDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}
