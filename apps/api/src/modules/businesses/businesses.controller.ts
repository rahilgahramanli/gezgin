import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { BusinessesService } from './businesses.service';

type Lang = 'az' | 'en' | 'ru';
const parseLang = (h?: string): Lang => {
  const v = h?.slice(0, 2).toLowerCase();
  return v === 'en' || v === 'ru' ? v : 'az';
};

class ContactDto {
  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @IsString() @MinLength(5) @MaxLength(1000)
  message!: string;
}

@ApiTags('businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Public() @Get()
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'region', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['otel', 'restoran', 'qonaq_evi', 'tur_sirketi', 'diger'] })
  @ApiOperation({ summary: 'Bizneslər' })
  list(
    @Headers('accept-language') lang?: string,
    @Query('q') q?: string,
    @Query('region') region?: string,
    @Query('type') type?: string,
    @Query('offset') offset = '0',
  ) {
    return this.businesses.list({ q, region, type, offset: Number(offset) }, parseLang(lang));
  }

  @Public() @Get(':slug')
  @ApiOperation({ summary: 'Biznes profili — ekran 22' })
  detail(@Param('slug') slug: string, @Headers('accept-language') lang?: string) {
    return this.businesses.detail(slug, parseLang(lang));
  }

  @Public() @Get(':slug/packages')
  @ApiOperation({ summary: 'Təkliflər və paketlər — ekran 22, 49' })
  packages(@Param('slug') slug: string) {
    return this.businesses.packages(slug);
  }

  @Public() @Get(':slug/photos')
  @ApiOperation({ summary: 'Biznes fotoları' })
  photos(@Param('slug') slug: string, @Query('offset') offset = '0') {
    return this.businesses.photos(slug, Number(offset));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':slug/contact')
  @ApiOperation({ summary: 'Mesaj göndər — ekran 22' })
  contact(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body() dto: ContactDto) {
    return this.businesses.contact(user.id, slug, dto.message);
  }
}
