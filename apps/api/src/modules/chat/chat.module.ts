import { Module } from '@nestjs/common';
import { MediaModule } from '@/modules/media/media.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [MediaModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
