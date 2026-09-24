import { Module } from '@nestjs/common';
import { MediaModule } from '@/modules/media/media.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  imports: [MediaModule],
  controllers: [StoriesController],
  providers: [StoriesService],
})
export class StoriesModule {}
