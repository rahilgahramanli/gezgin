import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { ReportDto } from '@/modules/community/dto/community.dto';
import { UsersService } from './users.service';
import { UserListDto, UserPostsDto } from './dto/users.dto';

type Viewer = { user?: AuthUser };

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // `:username`-dən əvvəl olmalıdır — əks halda "suggested" istifadəçi adı kimi tutulur
  @ApiBearerAuth() @Get('suggested')
  @ApiOperation({ summary: 'Tövsiyə olunan gezginlər — ekran 42' })
  suggested(@CurrentUser() user: AuthUser) {
    return this.users.suggested(user.id);
  }

  @Public() @Get(':username')
  @ApiOperation({ summary: 'Gezgin profili — ekran 41' })
  profile(@Param('username') username: string, @Req() req: Viewer) {
    return this.users.profile(username, req.user?.id);
  }

  @Public() @Get(':username/posts')
  @ApiOperation({ summary: 'İstifadəçinin paylaşımları' })
  posts(@Param('username') username: string, @Query() dto: UserPostsDto, @Req() req: Viewer) {
    return this.users.userPosts(username, dto, req.user?.id);
  }

  @Public() @Get(':username/routes')
  @ApiOperation({ summary: 'İstifadəçinin marşrutları' })
  routes(@Param('username') username: string, @Query() dto: UserListDto, @Req() req: Viewer) {
    return this.users.routes(username, dto, req.user?.id);
  }

  @Public() @Get(':username/badges')
  @ApiOperation({ summary: 'İstifadəçinin nailiyyətləri' })
  badges(@Param('username') username: string, @Req() req: Viewer) {
    return this.users.badges(username, req.user?.id);
  }

  @Public() @Get(':username/followers')
  @ApiOperation({ summary: 'İzləyicilər — ekran 42' })
  followers(@Param('username') username: string, @Query() dto: UserListDto, @Req() req: Viewer) {
    return this.users.followList(username, 'followers', dto, req.user?.id);
  }

  @Public() @Get(':username/following')
  @ApiOperation({ summary: 'İzlədikləri — ekran 42' })
  following(@Param('username') username: string, @Query() dto: UserListDto, @Req() req: Viewer) {
    return this.users.followList(username, 'following', dto, req.user?.id);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':username/follow')
  @ApiOperation({ summary: 'İzlə' })
  follow(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    return this.users.follow(user, username);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete(':username/follow')
  @ApiOperation({ summary: 'İzləməni dayandır' })
  unfollow(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    return this.users.unfollow(user.id, username);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':username/report')
  @ApiOperation({ summary: 'İstifadəçini şikayət et' })
  report(@CurrentUser() user: AuthUser, @Param('username') username: string, @Body() dto: ReportDto) {
    return this.users.report(user.id, username, dto);
  }
}
