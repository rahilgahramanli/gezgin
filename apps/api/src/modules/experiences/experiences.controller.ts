import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { ExperiencesService } from './experiences.service';
import {
  AvailabilityDto, CreateExperienceDto, CreateSlotsDto, ListExperiencesDto, UpdateExperienceDto,
} from './dto/experiences.dto';
import { parseLang } from '@/common/i18n';

@ApiTags('experiences')
@Controller('experiences')
export class ExperiencesController {
  constructor(private readonly experiences: ExperiencesService) {}

  @Public() @Get()
  @ApiOperation({ summary: 'Təcrübələr — kateqoriya, qiymət, müddət filtri (ekran 16)' })
  list(@Query() dto: ListExperiencesDto, @Headers('accept-language') lang?: string) {
    return this.experiences.list(dto, parseLang(lang));
  }

  @ApiBearerAuth() @Get('mine')
  @ApiOperation({ summary: 'Təcrübələrim — qaralamalar daxil (ekran 36)' })
  mine(@CurrentUser() user: AuthUser, @Headers('accept-language') lang?: string) {
    return this.experiences.mine(user.id, parseLang(lang));
  }

  @Public() @Get(':slug')
  @ApiOperation({ summary: 'Təcrübə detalı — 80/20 bölgüsü ilə (ekran 17)' })
  detail(@Param('slug') slug: string, @Headers('accept-language') lang?: string, @Req() req?: { user?: AuthUser }) {
    return this.experiences.detail(slug, parseLang(lang), req?.user?.id);
  }

  @Public() @Get(':slug/availability')
  @ApiOperation({ summary: 'Boş tarixlər — ekran 18 tarix seçici' })
  availability(@Param('slug') slug: string, @Query() dto: AvailabilityDto) {
    return this.experiences.availability(slug, dto);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post()
  @ApiOperation({ summary: 'Təcrübə yarat — ekran 56 (qaralama kimi)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExperienceDto, @Headers('accept-language') lang?: string) {
    return this.experiences.create(user.id, dto, parseLang(lang));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Patch(':slug')
  @ApiOperation({ summary: 'Təcrübəni redaktə et' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() dto: UpdateExperienceDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.experiences.update(user.id, slug, dto, parseLang(lang));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':slug/publish')
  @ApiOperation({ summary: 'Qaralamanı yayımla — tamlıq yoxlanılır' })
  publish(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Headers('accept-language') lang?: string) {
    return this.experiences.publish(user.id, slug, parseLang(lang));
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':slug/slots')
  @ApiOperation({ summary: 'Boş tarixlər əlavə et' })
  slots(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body() dto: CreateSlotsDto) {
    return this.experiences.createSlots(user.id, slug, dto);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete(':slug')
  @ApiOperation({ summary: 'Təcrübəni sil' })
  remove(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.experiences.remove(user.id, slug);
  }
}
