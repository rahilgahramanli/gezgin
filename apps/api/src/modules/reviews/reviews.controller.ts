import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ListReviewsDto, ReviewSummaryDto, UpdateReviewDto } from './dto/reviews.dto';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public() @Get()
  @ApiOperation({ summary: 'Rəylər — ekran 47' })
  list(@Query() dto: ListReviewsDto, @Req() req: { user?: AuthUser }) {
    return this.reviews.list(dto, req.user?.id);
  }

  @Public() @Get('summary')
  @ApiOperation({ summary: 'Reytinq bölgüsü — ekran 47 üst kartı' })
  summary(@Query() dto: ReviewSummaryDto) {
    return this.reviews.summary(dto.targetType, dto.target);
  }

  @ApiBearerAuth() @Get('mine')
  @ApiOperation({ summary: 'Bu obyektə öz rəyim (yoxdursa null) — rəy formu redaktə rejimində açılsın' })
  mine(@CurrentUser() user: AuthUser, @Query() dto: ReviewSummaryDto) {
    return this.reviews.mine(user.id, dto.targetType, dto.target);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post()
  @ApiOperation({ summary: 'Rəy yaz — ekran 27 (+400 XP)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user.id, dto);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Patch(':publicId')
  @ApiOperation({ summary: 'Rəyi redaktə et' })
  update(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: UpdateReviewDto) {
    return this.reviews.update(user.id, publicId, dto);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete(':publicId')
  @ApiOperation({ summary: 'Rəyi sil' })
  remove(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.reviews.remove(user.id, publicId);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':publicId/helpful')
  @ApiOperation({ summary: 'Rəyi faydalı işarələ' })
  helpful(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.reviews.markHelpful(user.id, publicId, true);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete(':publicId/helpful')
  @ApiOperation({ summary: 'Faydalı işarəsini götür' })
  unhelpful(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.reviews.markHelpful(user.id, publicId, false);
  }
}
