import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/stories.dto';

type Viewer = { user?: AuthUser };

@ApiTags('stories')
@Controller('stories')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Public() @Get()
  @ApiOperation({ summary: 'Hekayə dairələri — ekran 05 üst sırası' })
  rings(@Req() req: Viewer) {
    return this.stories.rings(req.user?.id);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post()
  @ApiOperation({ summary: 'Hekayə paylaş — 24 saat görünür' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStoryDto) {
    return this.stories.create(user.id, dto);
  }

  @Public() @Get(':username')
  @ApiOperation({ summary: 'İstifadəçinin aktiv hekayələri — ekran 40' })
  forUser(@Param('username') username: string, @Req() req: Viewer) {
    return this.stories.forUser(username, req.user?.id);
  }

  @ApiBearerAuth() @Post(':publicId/view')
  @ApiOperation({ summary: 'Baxıldı işarəsi' })
  view(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.stories.view(user.id, publicId);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete(':publicId')
  @ApiOperation({ summary: 'Hekayəni sil' })
  remove(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.stories.remove(user.id, publicId);
  }
}
