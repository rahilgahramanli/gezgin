import { Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { ReviewsService } from './reviews.service';
import { ListReviewsDto, ReviewSummaryDto } from './dto/reviews.dto';

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
