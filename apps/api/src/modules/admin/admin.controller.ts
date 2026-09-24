import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AdminService, type RequestMeta } from './admin.service';
import {
  AuditQueryDto,
  CONTENT_TYPES,
  type ContentType,
  ReportQueueDto,
  ResolveReportDto,
  SuspendUserDto,
  UserSearchDto,
} from './dto/admin.dto';

function meta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

/**
 * Admin paneli — moderasiya minimumu (AUDIT.md §7.1, Mərhələ A).
 *
 * Bütün endpointlər `admin` rolu tələb edir; `RolesGuard` qlobal qeydiyyatdadır,
 * ona görə sinif səviyyəsində bir dekorator kifayətdir. Hər dəyişiklik `AuditLog`-a yazılır.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Panel başlığı — açıq şikayətlər, SLA, istifadəçi və paylaşım sayı' })
  stats() {
    return this.admin.stats();
  }

  @Get('reports')
  @ApiOperation({ summary: 'Moderasiya növbəsi — şikayətlər kontent önizləməsi ilə' })
  reports(@Query() dto: ReportQueueDto) {
    return this.admin.reports(dto);
  }

  @Get('reports/:publicId')
  @ApiOperation({ summary: 'Şikayət detalı — tam kontent, təkrar şikayətlər, müəllif tarixçəsi' })
  report(@Param('publicId') publicId: string) {
    return this.admin.reportDetail(publicId);
  }

  @Post('reports/:publicId/resolve')
  @ApiOperation({ summary: 'Qərar: rədd et / kontenti sil / istifadəçini dayandır' })
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('publicId') publicId: string,
    @Body() dto: ResolveReportDto,
    @Req() req: Request,
  ) {
    return this.admin.resolveReport(user, publicId, dto, meta(req));
  }

  @Get('users')
  @ApiOperation({ summary: 'İstifadəçi axtarışı — ad, username, e-mail' })
  users(@Query() dto: UserSearchDto) {
    return this.admin.users(dto);
  }

  @Get('users/:username')
  @ApiOperation({ summary: 'İstifadəçi kartı — statistika və son şikayətlər' })
  user(@Param('username') username: string) {
    return this.admin.userDetail(username);
  }

  @Post('users/:username/suspend')
  @ApiOperation({ summary: 'Hesabı dayandır — aktiv sessiyalar da bağlanır' })
  suspend(
    @CurrentUser() admin: AuthUser,
    @Param('username') username: string,
    @Body() dto: SuspendUserDto,
    @Req() req: Request,
  ) {
    return this.admin.suspendUser(admin, username, dto, meta(req));
  }

  @Post('users/:username/restore')
  @ApiOperation({ summary: 'Dayandırılmış hesabı bərpa et' })
  restore(@CurrentUser() admin: AuthUser, @Param('username') username: string, @Req() req: Request) {
    return this.admin.restoreUser(admin, username, meta(req));
  }

  @Delete('content/:type/:publicId')
  @ApiParam({ name: 'type', enum: CONTENT_TYPES })
  @ApiOperation({ summary: 'Kontenti gizlət — paylaşım, şərh, rəy, hekayə' })
  deleteContent(
    @CurrentUser() admin: AuthUser,
    @Param('type') type: ContentType,
    @Param('publicId') publicId: string,
    @Req() req: Request,
  ) {
    return this.admin.deleteContent(admin, type, publicId, meta(req));
  }

  @Get('audit')
  @ApiOperation({ summary: 'Audit izi — kim, nə vaxt, nəyi dəyişdi' })
  audit(@Query() dto: AuditQueryDto) {
    return this.admin.auditTrail(dto);
  }
}
