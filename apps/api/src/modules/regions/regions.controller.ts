import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { RegionsService } from './regions.service';

type Lang = 'az' | 'en' | 'ru';
const parseLang = (header?: string): Lang => {
  const v = header?.slice(0, 2).toLowerCase();
  return v === 'en' || v === 'ru' ? v : 'az';
};

@ApiTags('regions')
@Controller('regions')
export class RegionsController {
  constructor(private readonly regions: RegionsService) {}

  @Public() @Get()
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiOperation({ summary: 'Regionlar — ekran 10 region seçici, ekran 32' })
  list(@Headers('accept-language') lang?: string, @Query('featured') featured?: string) {
    return this.regions.list(parseLang(lang), featured === 'true');
  }

  @Public() @Get('map')
  @ApiOperation({ summary: 'Xəritə üçün region nöqtələri — ekran 32' })
  map(@Headers('accept-language') lang?: string) {
    return this.regions.mapPoints(parseLang(lang));
  }

  @Public() @Get(':slug')
  @ApiOperation({ summary: 'Region detalı və say göstəriciləri' })
  detail(@Param('slug') slug: string, @Headers('accept-language') lang?: string) {
    return this.regions.detail(slug, parseLang(lang));
  }
}
