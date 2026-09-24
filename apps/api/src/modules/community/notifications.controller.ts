import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/community.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bildirişlər — ekran 07 (Hamısı · Sosial · Sistem)' })
  list(@CurrentUser() user: AuthUser, @Query() dto: ListNotificationsDto) {
    return this.notifications.list(user.id, dto);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Hamısını oxunmuş et' })
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':publicId/read')
  @ApiOperation({ summary: 'Bildirişi oxunmuş et' })
  read(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.notifications.markRead(user.id, publicId);
  }
}
