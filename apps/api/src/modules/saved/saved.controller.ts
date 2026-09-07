import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { SavedItemType } from '@prisma/client';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { SavedService } from './saved.service';
import { CreateCollectionDto, ListSavedDto, SaveItemDto, UpdateCollectionDto } from './dto/saved.dto';

type Lang = 'az' | 'en' | 'ru';
const parseLang = (h?: string): Lang => {
  const v = h?.slice(0, 2).toLowerCase();
  return v === 'en' || v === 'ru' ? v : 'az';
};

@ApiTags('saved')
@ApiBearerAuth()
@UseGuards(GuestBlockedGuard)
@Controller()
export class SavedController {
  constructor(private readonly saved: SavedService) {}

  @Get('saved')
  @ApiOperation({ summary: 'Want to go — saxlanılanlar (ekran 33)' })
  list(@CurrentUser() user: AuthUser, @Query() dto: ListSavedDto, @Headers('accept-language') lang?: string) {
    return this.saved.list(user.id, dto, parseLang(lang));
  }

  @Post('saved')
  @ApiOperation({ summary: 'Saxla — bookmark düyməsi' })
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveItemDto, @Headers('accept-language') lang?: string) {
    return this.saved.save(user.id, dto, parseLang(lang));
  }

  @Delete('saved/:type/:target')
  @ApiQuery({ name: 'type', enum: ['place', 'route', 'experience', 'event', 'post', 'business'] })
  @ApiOperation({ summary: 'Saxlamanı götür' })
  unsave(
    @CurrentUser() user: AuthUser,
    @Param('type') type: SavedItemType,
    @Param('target') target: string,
    @Headers('accept-language') lang?: string,
  ) {
    return this.saved.unsave(user.id, type, target, parseLang(lang));
  }

  @Get('collections')
  @ApiOperation({ summary: 'Kolleksiyalar — ekran 33 üst zolağı' })
  collections(@CurrentUser() user: AuthUser) {
    return this.saved.collections(user.id);
  }

  @Post('collections')
  @ApiOperation({ summary: 'Yeni kolleksiya — ekran 33 "Yeni"' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCollectionDto) {
    return this.saved.createCollection(user.id, dto);
  }

  @Patch('collections/:publicId')
  @ApiOperation({ summary: 'Kolleksiyanı redaktə et' })
  update(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: UpdateCollectionDto) {
    return this.saved.updateCollection(user.id, publicId, dto);
  }

  @Delete('collections/:publicId')
  @ApiOperation({ summary: 'Kolleksiyanı sil — saxlanılanlar qalır' })
  remove(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.saved.removeCollection(user.id, publicId);
  }
}
