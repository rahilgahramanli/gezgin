import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength,
} from 'class-validator';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
  @ApiProperty({ example: 'Aysel Məmmədova' })
  @IsString() @MinLength(2) @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'aysel.go', description: 'Latın hərfləri, rəqəm, nöqtə və alt xətt' })
  @Transform(lower)
  @Matches(/^[a-z0-9._]{3,32}$/, { message: 'İstifadəçi adı 3–32 simvol: a-z, 0-9, nöqtə, alt xətt' })
  username!: string;

  @ApiProperty({ example: 'aysel@gezgin.app' })
  @Transform(lower) @IsEmail({}, { message: 'E-mail düzgün deyil' })
  email!: string;

  @ApiProperty({ minLength: 8, description: 'Ən azı 8 simvol' })
  @IsString() @MinLength(8, { message: 'Şifrə ən azı 8 simvol olmalıdır' }) @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ description: 'E-mail və ya istifadəçi adı' })
  @Transform(lower) @IsString() @MinLength(3)
  identifier!: string;

  @ApiProperty()
  @IsString() @MinLength(1)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString() @MinLength(20)
  refreshToken!: string;
}

export class SendOtpDto {
  @ApiProperty({ example: 'aysel@gezgin.app' })
  @Transform(lower) @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['register', 'login', 'password_reset', 'email_change'] })
  @IsIn(['register', 'login', 'password_reset', 'email_change'])
  purpose!: 'register' | 'login' | 'password_reset' | 'email_change';
}

export class VerifyOtpDto {
  @ApiProperty()
  @Transform(lower) @IsEmail()
  email!: string;

  @ApiProperty({ example: '482715' })
  @IsString() @Length(6, 6, { message: 'Kod 6 rəqəm olmalıdır' })
  code!: string;

  @ApiProperty({ enum: ['register', 'login', 'password_reset', 'email_change'] })
  @IsIn(['register', 'login', 'password_reset', 'email_change'])
  purpose!: 'register' | 'login' | 'password_reset' | 'email_change';
}

export class ForgotPasswordDto {
  @ApiProperty()
  @Transform(lower) @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @Transform(lower) @IsEmail()
  email!: string;

  @ApiProperty({ example: '482715' })
  @IsString() @Length(6, 6)
  code!: string;

  @ApiProperty({ minLength: 8 })
  @IsString() @MinLength(8) @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString() @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString() @MinLength(8) @MaxLength(128)
  newPassword!: string;
}

export class SocialLoginDto {
  @ApiProperty({ description: 'Google id_token / Apple identity_token. Mock rejimdə: mock:<email>' })
  @IsString() @MinLength(5)
  token!: string;

  @ApiPropertyOptional({ description: 'Apple yalnız ilk girişdə ad göndərir' })
  @IsOptional() @IsString() @MaxLength(120)
  fullName?: string;
}
