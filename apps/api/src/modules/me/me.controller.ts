import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { MeService } from './me.service';
import {
  BlockUserDto, SetInterestsDto, SetProfileMediaDto, UpdateMeDto, UpdateSettingsDto,
} from './dto/me.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @ApiOperation({ summary: 'Öz profilim — ekran 28, 54' })
  profile(@CurrentUser() user: AuthUser) {
    return this.me.profile(user.id);
  }

  @Patch() @UseGuards(GuestBlockedGuard)
  @ApiOperation({ summary: 'Profili redaktə et — ekran 54' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.me.update(user.id, dto);
  }

  @Post('avatar') @UseGuards(GuestBlockedGuard)
  @ApiOperation({ summary: 'Avatarı təyin et — ekran 39, 54' })
  avatar(@CurrentUser() user: AuthUser, @Body() dto: SetProfileMediaDto) {
    return this.me.setProfileMedia(user.id, 'avatar', dto.mediaPublicId);
  }

  @Post('cover') @UseGuards(GuestBlockedGuard)
  @ApiOperation({ summary: 'Cover şəklini təyin et — ekran 54' })
  cover(@CurrentUser() user: AuthUser, @Body() dto: SetProfileMediaDto) {
    return this.me.setProfileMedia(user.id, 'cover', dto.mediaPublicId);
  }

  @Get('interests')
  @ApiOperation({ summary: 'Maraqlarım' })
  interests(@CurrentUser() user: AuthUser) {
    return this.me.interests(user.id);
  }

  @Put('interests') @UseGuards(GuestBlockedGuard)
  @ApiOperation({ summary: 'Maraqları təyin et — ekran 04' })
  setInterests(@CurrentUser() user: AuthUser, @Body() dto: SetInterestsDto) {
    return this.me.setInterests(user.id, dto);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Tənzimləmələr — ekran 34' })
  settings(@CurrentUser() user: AuthUser) {
    return this.me.settings(user.id);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Tənzimləmələri dəyiş — ekran 34' })
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.me.updateSettings(user.id, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Profil statistikası — ekran 28' })
  stats(@CurrentUser() user: AuthUser) {
    return this.me.stats(user.id);
  }

  @Get('regions')
  @ApiOperation({ summary: 'Region tərəqqisi — ekran 32' })
  regions(@CurrentUser() user: AuthUser) {
    return this.me.regionProgress(user.id);
  }

  @Get('blocked')
  @ApiOperation({ summary: 'Bloklanmış istifadəçilər — ekran 34' })
  blocked(@CurrentUser() user: AuthUser) {
    return this.me.blocked(user.id);
  }

  @Post('blocked/:username') @UseGuards(GuestBlockedGuard)
  @ApiOperation({ summary: 'İstifadəçini blokla' })
  block(@CurrentUser() user: AuthUser, @Param('username') username: string, @Body() dto: BlockUserDto) {
    return this.me.block(user.id, username, dto);
  }

  @Delete('blocked/:username') @UseGuards(GuestBlockedGuard)
  @ApiOperation({ summary: 'Bloku götür' })
  unblock(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    return this.me.unblock(user.id, username);
  }

  @Delete() @UseGuards(GuestBlockedGuard)
  @ApiOperation({ summary: 'Hesabı sil — ekran 54 (məlumatlar anonimləşdirilir)' })
  remove(@CurrentUser() user: AuthUser) {
    return this.me.deleteAccount(user.id);
  }
}
