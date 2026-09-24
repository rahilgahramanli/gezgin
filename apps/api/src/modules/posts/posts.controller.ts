import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { ReportDto } from '@/modules/community/dto/community.dto';
import { CommentsService } from './comments.service';
import { PostsService } from './posts.service';
import { CommentsQueryDto, CreateCommentDto, CreatePostDto, FeedDto, UpdatePostDto } from './dto/posts.dto';

type Viewer = { user?: AuthUser };

@ApiTags('posts')
@Controller()
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
  ) {}

  @Public() @Get('feed')
  @ApiOperation({ summary: 'Lent — For you / Following / Nearby (ekran 05)' })
  feed(@Query() dto: FeedDto, @Req() req: Viewer) {
    return this.posts.feed(dto, req.user?.id);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post('posts')
  @ApiOperation({ summary: 'Paylaşım yarat — ekran 26 (foto ilə +300 XP)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.posts.create(user.id, dto);
  }

  @Public() @Get('posts/:publicId')
  @ApiOperation({ summary: 'Paylaşım detalı — ekran 06' })
  detail(@Param('publicId') publicId: string, @Req() req: Viewer) {
    return this.posts.detail(publicId, req.user?.id);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Patch('posts/:publicId')
  @ApiOperation({ summary: 'Paylaşımı redaktə et' })
  update(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: UpdatePostDto) {
    return this.posts.update(user.id, publicId, dto);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete('posts/:publicId')
  @ApiOperation({ summary: 'Paylaşımı sil' })
  remove(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.posts.remove(user.id, publicId);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post('posts/:publicId/like')
  @ApiOperation({ summary: 'Bəyən' })
  like(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.posts.setLike(user.id, publicId, true);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete('posts/:publicId/like')
  @ApiOperation({ summary: 'Bəyənməni geri al' })
  unlike(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.posts.setLike(user.id, publicId, false);
  }

  @Public() @Get('posts/:publicId/comments')
  @ApiOperation({ summary: 'Şərhlər — ekran 06' })
  listComments(@Param('publicId') publicId: string, @Query() dto: CommentsQueryDto, @Req() req: Viewer) {
    return this.comments.list(publicId, dto, req.user?.id);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post('posts/:publicId/comments')
  @ApiOperation({ summary: 'Şərh və ya cavab yaz' })
  addComment(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: CreateCommentDto) {
    return this.comments.create(user.id, publicId, dto);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post('posts/:publicId/save')
  @ApiOperation({ summary: 'Saxla — ekran 33-ə düşür' })
  save(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.posts.setSaved(user.id, publicId, true);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete('posts/:publicId/save')
  @ApiOperation({ summary: 'Saxlanılanlardan çıxar' })
  unsave(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.posts.setSaved(user.id, publicId, false);
  }

  @ApiBearerAuth() @Post('posts/:publicId/share')
  @ApiOperation({ summary: 'Paylaşım linki — ekran 43' })
  share(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.posts.share(user.id, publicId);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post('posts/:publicId/report')
  @ApiOperation({ summary: 'Şikayət et — ekran 43' })
  report(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: ReportDto) {
    return this.posts.report(user.id, publicId, dto);
  }
}

@ApiTags('posts')
@ApiBearerAuth()
@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @UseGuards(GuestBlockedGuard) @Delete(':publicId')
  @ApiOperation({ summary: 'Şərhi sil — müəllif və ya paylaşım sahibi' })
  remove(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.comments.remove(user.id, publicId);
  }

  @UseGuards(GuestBlockedGuard) @Post(':publicId/like')
  @ApiOperation({ summary: 'Şərhi bəyən' })
  like(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.comments.setLike(user.id, publicId, true);
  }

  @UseGuards(GuestBlockedGuard) @Delete(':publicId/like')
  @ApiOperation({ summary: 'Şərh bəyənməsini geri al' })
  unlike(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.comments.setLike(user.id, publicId, false);
  }
}
