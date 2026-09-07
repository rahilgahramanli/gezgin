import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({ enum: ['bug', 'idea', 'content', 'other'] })
  @IsIn(['bug', 'idea', 'content', 'other'])
  type!: 'bug' | 'idea' | 'content' | 'other';

  @ApiProperty({ minLength: 5, maxLength: 2000 })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Tətbiq versiyası və cihaz — diaqnostika üçün' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  context?: string;
}
