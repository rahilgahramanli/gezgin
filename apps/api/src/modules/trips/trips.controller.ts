import {
  Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { TripsService } from './trips.service';
import {
  AddDayDto, AddNoteDto, AddTripItemDto, CreateTripDto, ListTripsDto,
  ReorderTripItemsDto, UpdateTripDto, UpdateTripItemDto,
} from './dto/trips.dto';

type Lang = 'az' | 'en' | 'ru';
const parseLang = (h?: string): Lang => {
  const v = h?.slice(0, 2).toLowerCase();
  return v === 'en' || v === 'ru' ? v : 'az';
};

@ApiTags('trips')
@ApiBearerAuth()
@UseGuards(GuestBlockedGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get()
  @ApiOperation({ summary: 'Səyahətlərim — ekran 23' })
  list(@CurrentUser() user: AuthUser, @Query() dto: ListTripsDto) {
    return this.trips.list(user.id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Yeni səyahət — sıfırdan və ya marşrutdan (ekran 24)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTripDto, @Headers('accept-language') lang?: string) {
    return this.trips.create(user.id, dto, parseLang(lang));
  }

  @Get(':publicId')
  @ApiOperation({ summary: 'Səyahət detalı — gün-gün plan və xəritə (ekran 23)' })
  detail(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Headers('accept-language') lang?: string) {
    return this.trips.detail(publicId, user.id, parseLang(lang));
  }

  @Patch(':publicId')
  @ApiOperation({ summary: 'Səyahəti redaktə et' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('publicId') publicId: string,
    @Body() dto: UpdateTripDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.trips.update(user.id, publicId, dto, parseLang(lang));
  }

  @Delete(':publicId')
  @ApiOperation({ summary: 'Səyahəti sil' })
  remove(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.trips.remove(user.id, publicId);
  }

  @Post(':publicId/days')
  @ApiOperation({ summary: 'Gün əlavə et — ekran 50 "+ Gün"' })
  addDay(
    @CurrentUser() user: AuthUser,
    @Param('publicId') publicId: string,
    @Body() dto: AddDayDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.trips.addDay(user.id, publicId, dto, parseLang(lang));
  }

  @Delete(':publicId/days/:dayId')
  @ApiOperation({ summary: 'Günü sil — elementlər əvvəlki günə keçir' })
  removeDay(
    @CurrentUser() user: AuthUser,
    @Param('publicId') publicId: string,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Headers('accept-language') lang?: string,
  ) {
    return this.trips.removeDay(user.id, publicId, dayId, parseLang(lang));
  }

  @Post(':publicId/items')
  @ApiOperation({ summary: 'Plana element əlavə et — ekran 48' })
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('publicId') publicId: string,
    @Body() dto: AddTripItemDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.trips.addItem(user.id, publicId, dto, parseLang(lang));
  }

  @Patch(':publicId/items/:itemId')
  @ApiOperation({ summary: 'Elementi redaktə et və ya tamamlandı işarələ — ekran 23' })
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('publicId') publicId: string,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateTripItemDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.trips.updateItem(user.id, publicId, itemId, dto, parseLang(lang));
  }

  @Delete(':publicId/items/:itemId')
  @ApiOperation({ summary: 'Elementi plandan çıxar' })
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('publicId') publicId: string,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Headers('accept-language') lang?: string,
  ) {
    return this.trips.removeItem(user.id, publicId, itemId, parseLang(lang));
  }

  @Put(':publicId/items/reorder')
  @ApiOperation({ summary: 'Elementləri sırala' })
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('publicId') publicId: string,
    @Body() dto: ReorderTripItemsDto,
    @Headers('accept-language') lang?: string,
  ) {
    return this.trips.reorderItems(user.id, publicId, dto, parseLang(lang));
  }

  @Post(':publicId/start')
  @ApiOperation({ summary: 'Səyahəti başlat — ekran 15 "Marşrutu başlat"' })
  start(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Headers('accept-language') lang?: string) {
    return this.trips.start(user.id, publicId, parseLang(lang));
  }

  @Post(':publicId/complete')
  @ApiOperation({ summary: 'Səyahəti tamamla' })
  complete(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Headers('accept-language') lang?: string) {
    return this.trips.complete(user.id, publicId, parseLang(lang));
  }

  @Post(':publicId/notes')
  @ApiOperation({ summary: 'Qeyd əlavə et — ekran 23 "Qeydlər" tabı' })
  addNote(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: AddNoteDto) {
    return this.trips.addNote(user.id, publicId, dto);
  }
}
