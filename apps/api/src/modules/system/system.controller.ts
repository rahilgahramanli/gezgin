import { Body, Controller, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateFeedbackDto } from './dto/feedback.dto';
import { SystemService } from './system.service';

@ApiTags('system')
@Controller()
export class SystemController {
  constructor(
    private readonly system: SystemService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Servis vəziyyəti — konteyner healthcheck bunu çağırır' })
  health() {
    return this.system.health();
  }

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Tətbiq konfiqurasiyası: XP qaydaları, levellər, feature flag-lar' })
  config() {
    return this.system.appConfig();
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Kateqoriyalar — məkan, marşrut, təcrübə, tədbir' })
  categories(@Query('type') type?: string) {
    return this.system.categories(type);
  }

  @Public()
  @Get('app-version')
  @ApiOperation({ summary: 'Minimum və son tətbiq versiyası' })
  appVersion() {
    return this.system.appVersion();
  }

  @Public()
  @Get('legal/:slug')
  @ApiOperation({ summary: 'Hüquqi sənəd: terms, privacy, expert-terms' })
  legal(@Param('slug') slug: string, @Req() req: Request) {
    // Brauzerdə açılan versiyanın ünvanı — App Store "Privacy Policy URL" sahəsi üçün
    const base = `${req.protocol}://${req.get('host') ?? 'localhost'}`;
    return this.system.legal(slug, `${base}/api/v1/legal/${slug}/page`);
  }

  @Public()
  @Get('legal/:slug/page')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Hüquqi sənədin HTML səhifəsi (brauzer üçün)' })
  legalPage(@Param('slug') slug: string) {
    return this.system.legalHtml(slug);
  }

  @Public()
  @Post('feedback')
  @ApiOperation({ summary: 'İstifadəçi rəyi və ya xəta bildirişi' })
  async feedback(@Body() dto: CreateFeedbackDto) {
    await this.prisma.auditLog.create({
      data: {
        action: `feedback.${dto.type}`,
        targetType: 'feedback',
        after: { message: dto.message, email: dto.email ?? null, context: dto.context ?? null },
      },
    });
    return { received: true };
  }
}
