import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { MediaService } from './media.service';
import { CompleteUploadDto, PresignDto } from './dto/media.dto';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post('presign')
  @ApiOperation({ summary: 'Yükləmə linki al — fayl birbaşa S3-ə gedir' })
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.media.presign(user, dto);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post(':publicId/complete')
  @ApiOperation({ summary: 'Yükləməni təsdiqlə' })
  complete(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: CompleteUploadDto) {
    return this.media.complete(user.id, publicId, dto);
  }

  @Public() @Get(':publicId')
  @ApiOperation({ summary: 'Media məlumatı' })
  get(@Param('publicId') publicId: string) {
    return this.media.get(publicId);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete(':publicId')
  @ApiOperation({ summary: 'Medianı sil' })
  remove(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.media.remove(user.id, publicId);
  }
}
