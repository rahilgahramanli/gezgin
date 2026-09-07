import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto, ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto,
  ResetPasswordDto, SendOtpDto, SocialLoginDto, VerifyOtpDto,
} from './dto/auth.dto';

/** Brute-force-a qarşı sərt limit: dəqiqədə 10 cəhd. */
const AUTH_THROTTLE = { short: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private ctx(req: Request) {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Public() @Post('register') @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Qeydiyyat — ekran 03' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.ctx(req));
  }

  @Public() @Post('login') @HttpCode(200) @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'E-mail və ya istifadəçi adı ilə giriş — ekran 02' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.ctx(req));
  }

  @Public() @Post('guest') @HttpCode(200) @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Qonaq kimi davam et — ekran 01' })
  guest(@Req() req: Request) {
    return this.auth.guest(this.ctx(req));
  }

  @Public() @Post('refresh') @HttpCode(200)
  @ApiOperation({ summary: 'Access tokeni yenilə (rotasiya + təkrar istifadə aşkarlaması)' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.ctx(req));
  }

  @Public() @Post('logout') @HttpCode(200)
  @ApiOperation({ summary: 'Çıxış — refresh tokeni ləğv edir' })
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public() @Post('otp/send') @HttpCode(200) @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Təsdiq kodu göndər — ekran 37' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto.email, dto.purpose);
  }

  @Public() @Post('otp/verify') @HttpCode(200) @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Kodu təsdiqlə — ekran 38' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.email, dto.code, dto.purpose);
  }

  @Public() @Post('password/forgot') @HttpCode(200) @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Şifrəni unutdum — ekran 37' })
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public() @Post('password/reset') @HttpCode(200) @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Kodla yeni şifrə təyin et' })
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post('password/change') @HttpCode(200)
  @ApiOperation({ summary: 'Şifrəni dəyiş — ekran 34' })
  change(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }

  @Public() @Post('social/google') @HttpCode(200) @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Google ilə davam et — ekran 02, 03' })
  google(@Body() dto: SocialLoginDto, @Req() req: Request) {
    return this.auth.loginWithGoogle(dto, this.ctx(req));
  }

  @Public() @Post('social/apple') @HttpCode(200) @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Apple ilə davam et — ekran 02, 03' })
  apple(@Body() dto: SocialLoginDto, @Req() req: Request) {
    return this.auth.loginWithApple(dto, this.ctx(req));
  }
}
