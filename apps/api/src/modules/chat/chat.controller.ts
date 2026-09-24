import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { ChatService } from './chat.service';
import { ListConversationsDto, MessagesQueryDto, OpenConversationDto, SendMessageDto } from './dto/chat.dto';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(GuestBlockedGuard)
@Controller('conversations')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Söhbətlər — ekran 08' })
  list(@CurrentUser() user: AuthUser, @Query() dto: ListConversationsDto) {
    return this.chat.list(user.id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Söhbət aç (mövcuddursa onu qaytarır)' })
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenConversationDto) {
    return this.chat.open(user.id, dto.username);
  }

  @Get(':publicId')
  @ApiOperation({ summary: 'Söhbət başlığı — ekran 09' })
  detail(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.chat.detail(user.id, publicId);
  }

  @Get(':publicId/messages')
  @ApiOperation({ summary: 'Mesajlar — yenidən köhnəyə' })
  messages(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Query() dto: MessagesQueryDto) {
    return this.chat.messages(user.id, publicId, dto);
  }

  @Post(':publicId/messages')
  @ApiOperation({ summary: 'Mesaj göndər — WebSocket ilə çatdırılır' })
  send(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: SendMessageDto) {
    return this.chat.send(user, publicId, dto);
  }

  @Post(':publicId/read')
  @ApiOperation({ summary: 'Oxunmuş et' })
  read(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.chat.markRead(user.id, publicId);
  }

  @Delete(':publicId')
  @ApiOperation({ summary: 'Söhbəti özündən gizlət' })
  leave(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.chat.leave(user.id, publicId);
  }
}
