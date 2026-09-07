import {
  Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { RoutesService } from './routes.service';
import {
  AddStopDto, CreateRouteDto, ListRoutesDto, ReorderStopsDto, UpdateRouteDto, UpdateStopDto,
} from './dto/routes.dto';

type Lang = 'az' | 'en' | 'ru';
const parseLang = (h?: string): Lang => {
  const v = h?.slice(0, 2).toLowerCase();
  return v === 'en' || v === 'ru' ? v : 'az';
};

@ApiTags('routes')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Public() @Get()
  @ApiOperation({ summary: 'Marşrutlar — müddət, region, çətinlik filtri (ekran 14)' })
  list(@Query() dto: ListRoutesDto, @Headers('accept-language') lang?: string, @Req() req?: { user?: AuthUser }) {
    return this.routes.list(dto, parseLang(lang), req?.user?.id);
  }

  @Public() @Get('recommended')
  @ApiQuery({ name: 'region', required: false })
  @ApiOperation({ summary: 'Tövsiyə olunan marşrutlar — ekran 14' })
  recommended(@Query('region') region?: string, @Headers('accept-language') lang?: string) {
    return this.routes.recommended(parseLang(lang), region);
  }

  @ApiBearerAuth() @Get('mine')
  @ApiOperation({ summary: 'Sənin marşrutların — ekran 14' })
  mine(@CurrentUser() user: AuthUser, @Headers('accept-language') lang?: string, @Query('offset') offset = '0') {
    return this.routes.mine(user.id, parseLang(lang), Number(offset));
  }

  @Public() @Get(':slug')
  @ApiOperation({ summary: 'Marşrut detalı — gün-gün dayanacaqlar (ekran 15)' })
  detail(@Param('slug') slug: string, @Headers('accept-language') lang?: string, @Req() req?: { user?: AuthUser }) {
    return this.routes.detail(slug, parseLang(lang), req?.user?.id);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post()
  @ApiOperation({ summary: 'Marşrut yarat — ekran 50' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRouteDto, @Headers('accept-language') lang?: string) {
    return this.routes.create(user.id, dto, parseLang(lang));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Patch(':slug')
  @ApiOperation({ summary: 'Marşrutu redaktə et' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() dto: UpdateRouteDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.routes.update(user.id, slug, dto, parseLang(lang));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete(':slug')
  @ApiOperation({ summary: 'Marşrutu sil' })
  remove(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.routes.remove(user.id, slug);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':slug/stops')
  @ApiOperation({ summary: 'Dayanacaq əlavə et — ekran 50' })
  addStop(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() dto: AddStopDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.routes.addStop(user.id, slug, dto, parseLang(lang));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Patch(':slug/stops/:stopId')
  @ApiOperation({ summary: 'Dayanacağı redaktə et' })
  updateStop(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('stopId', ParseIntPipe) stopId: number,
    @Body() dto: UpdateStopDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.routes.updateStop(user.id, slug, stopId, dto, parseLang(lang));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete(':slug/stops/:stopId')
  @ApiOperation({ summary: 'Dayanacağı sil' })
  removeStop(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('stopId', ParseIntPipe) stopId: number,
    @Headers('accept-language') lang?: string,
  ) {
    return this.routes.removeStop(user.id, slug, stopId, parseLang(lang));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Put(':slug/stops/reorder')
  @ApiOperation({ summary: 'Dayanacaqları sırala — ekran 50 sürüklə-burax' })
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() dto: ReorderStopsDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.routes.reorderStops(user.id, slug, dto, parseLang(lang));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':slug/copy')
  @ApiOperation({ summary: 'Marşrutu öz siyahına kopyala — ekran 41' })
  copy(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Headers('accept-language') lang?: string) {
    return this.routes.copy(user.id, slug, parseLang(lang));
  }
}
