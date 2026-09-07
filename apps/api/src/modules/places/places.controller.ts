import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { PlacesService } from './places.service';
import { AddPlacePhotoDto, ListPlacesDto, MapPlacesDto, NearbyDto, ReportPlaceDto } from './dto/places.dto';

type Lang = 'az' | 'en' | 'ru';
const parseLang = (h?: string): Lang => {
  const v = h?.slice(0, 2).toLowerCase();
  return v === 'en' || v === 'ru' ? v : 'az';
};

@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Public() @Get()
  @ApiOperation({ summary: 'Məkanlar — filtr, axtarış, yaxınlıq (ekran 12, 45)' })
  list(@Query() dto: ListPlacesDto, @Headers('accept-language') lang?: string) {
    return this.places.list(dto, parseLang(lang));
  }

  @Public() @Get('map')
  @ApiOperation({ summary: 'Xəritə pinləri — zoom-a görə klasterlənir (ekran 12)' })
  map(@Query() dto: MapPlacesDto, @Headers('accept-language') lang?: string) {
    return this.places.map(dto, parseLang(lang));
  }

  @Public() @Get('filters')
  @ApiQuery({ name: 'region', required: false })
  @ApiOperation({ summary: 'Mövcud filtr seçimləri — ekran 45' })
  filters(@Query('region') region?: string) {
    return this.places.filters(region);
  }

  @Public() @Get(':slug')
  @ApiOperation({ summary: 'Məkan detalı — ekran 13' })
  detail(@Param('slug') slug: string, @Headers('accept-language') lang?: string) {
    return this.places.detail(slug, parseLang(lang));
  }

  @Public() @Get(':slug/photos')
  @ApiQuery({ name: 'filter', required: false, enum: ['all', 'official', 'community'] })
  @ApiOperation({ summary: 'Foto qalereyası — ekran 46' })
  photos(
    @Param('slug') slug: string,
    @Query('filter') filter: 'all' | 'official' | 'community' = 'all',
    @Query('offset') offset = '0',
    @Query('limit') limit = '30',
  ) {
    return this.places.photos(slug, filter, Number(offset), Math.min(Number(limit), 50));
  }

  @Public() @Get(':slug/nearby')
  @ApiOperation({ summary: 'Yaxınlıqdakı məkanlar — ekran 13' })
  nearby(@Param('slug') slug: string, @Query() dto: NearbyDto, @Headers('accept-language') lang?: string) {
    return this.places.nearby(slug, dto, parseLang(lang));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':slug/photos')
  @ApiOperation({ summary: 'Məkana foto əlavə et — ekran 46' })
  addPhoto(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body() dto: AddPlacePhotoDto) {
    return this.places.addPhoto(user.id, slug, dto);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':slug/report')
  @ApiOperation({ summary: 'Məkan haqqında şikayət' })
  report(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body() dto: ReportPlaceDto) {
    return this.places.report(user.id, slug, dto);
  }
}
