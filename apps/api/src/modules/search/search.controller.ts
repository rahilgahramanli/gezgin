import { Controller, Delete, Get, Headers, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { SearchService, type SearchType } from './search.service';

type Lang = 'az' | 'en' | 'ru';
const parseLang = (h?: string): Lang => {
  const v = h?.slice(0, 2).toLowerCase();
  return v === 'en' || v === 'ru' ? v : 'az';
};

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public() @Get()
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'types', required: false, description: 'place,route,experience,event,user' })
  @ApiQuery({ name: 'region', required: false })
  @ApiOperation({ summary: 'Qarışıq axtarış — ekran 11' })
  find(
    @Query('q') q: string,
    @Headers('accept-language') lang?: string,
    @Query('types') types?: string,
    @Query('region') region?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('limit') limit?: string,
    @Req() req?: { user?: AuthUser },
  ) {
    return this.search.search(
      {
        q: q ?? '',
        types: types ? (types.split(',').filter(Boolean) as SearchType[]) : undefined,
        region,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        limit: limit ? Math.min(Number(limit), 50) : undefined,
      },
      parseLang(lang),
      req?.user?.id,
    );
  }

  @Public() @Get('suggest')
  @ApiQuery({ name: 'q', required: true })
  @ApiOperation({ summary: 'Yazarkən təkliflər — ekran 11' })
  suggest(@Query('q') q: string, @Headers('accept-language') lang?: string) {
    return this.search.suggest(q ?? '', parseLang(lang));
  }

  @Public() @Get('popular')
  @ApiOperation({ summary: 'Populyar axtarışlar — ekran 11' })
  popular() {
    return this.search.popular();
  }

  @ApiBearerAuth() @Get('recent')
  @ApiOperation({ summary: 'Son axtarışlarım — ekran 11' })
  recent(@CurrentUser() user: AuthUser) {
    return this.search.recent(user.id);
  }

  @ApiBearerAuth() @Delete('recent')
  @ApiOperation({ summary: 'Axtarış tarixçəsini təmizlə — ekran 11 "Təmizlə"' })
  clear(@CurrentUser() user: AuthUser) {
    return this.search.clearRecent(user.id);
  }
}
