import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { OfflineService } from './offline.service';

@ApiTags('offline')
@Controller('offline')
export class OfflineController {
  constructor(private readonly offline: OfflineService) {}

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Get('packages')
  @ApiOperation({ summary: 'Offline paketlər və yaddaş — ekran 25' })
  packages(@CurrentUser() user: AuthUser) {
    return this.offline.packages(user.id);
  }

  @Public() @Get('packages/:region/manifest')
  @ApiOperation({ summary: 'Paketin məzmunu — mobil tərəf yerli bazaya yazır' })
  manifest(@Param('region') region: string) {
    return this.offline.manifest(region);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post('packages/:region/download')
  @ApiOperation({ summary: 'Yükləməni qeydə al — ekran 25' })
  download(@CurrentUser() user: AuthUser, @Param('region') region: string) {
    return this.offline.markDownloaded(user.id, region);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete('packages/:region')
  @ApiOperation({ summary: 'Yüklənmiş paketi sil' })
  remove(@CurrentUser() user: AuthUser, @Param('region') region: string) {
    return this.offline.removeDownload(user.id, region);
  }
}
