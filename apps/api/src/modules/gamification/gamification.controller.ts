import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { XpService } from './xp.service';
import { GamificationService } from './gamification.service';
import { CheckinDto, LeaderboardDto } from './dto/gamification.dto';

@ApiTags('gamification')
@Controller()
export class GamificationController {
  constructor(
    private readonly xp: XpService,
    private readonly gamification: GamificationService,
  ) {}

  @ApiBearerAuth() @Get('me/score')
  @ApiOperation({ summary: 'Gezgin Score və level tərəqqisi — ekran 29' })
  score(@CurrentUser() user: AuthUser) {
    return this.xp.score(user.id);
  }

  @ApiBearerAuth() @Get('me/xp')
  @ApiOperation({ summary: 'XP tarixçəsi — ekran 29' })
  history(@CurrentUser() user: AuthUser, @Query('offset') offset = '0') {
    return this.xp.history(user.id, Number(offset));
  }

  @Public() @Get('levels')
  @ApiOperation({ summary: 'Level nərdivanı — ekran 30' })
  levels(@Req() req: { user?: AuthUser }) {
    return this.xp.levels(req.user?.id);
  }

  @Public() @Get('badges')
  @ApiOperation({ summary: 'Bütün badge-lər' })
  badges() {
    return this.xp.badges();
  }

  @ApiBearerAuth() @Get('me/badges')
  @ApiOperation({ summary: 'Nailiyyətlərim və tərəqqi — ekran 30' })
  myBadges(@CurrentUser() user: AuthUser) {
    return this.xp.badges(user.id);
  }

  @Public() @Get('leaderboard')
  @ApiOperation({ summary: 'Liderlər cədvəli — ekran 31' })
  leaderboard(@Query() dto: LeaderboardDto, @Req() req: { user?: AuthUser }) {
    return this.gamification.leaderboard(dto, req.user?.id);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post('checkins')
  @ApiOperation({ summary: 'Məkanda check-in — ekran 51 → 52' })
  checkin(@CurrentUser() user: AuthUser, @Body() dto: CheckinDto) {
    return this.gamification.checkin(user.id, dto);
  }

  @ApiBearerAuth() @Get('me/checkins')
  @ApiOperation({ summary: 'Check-in tarixçəm' })
  myCheckins(@CurrentUser() user: AuthUser, @Query('offset') offset = '0') {
    return this.gamification.myCheckins(user.id, Number(offset));
  }

  @Public() @Get('xp-rules')
  @ApiOperation({ summary: 'XP qazanma qaydaları — ekran 29 (level nərdivanı: /levels)' })
  rules() {
    return this.xp.rules();
  }
}
