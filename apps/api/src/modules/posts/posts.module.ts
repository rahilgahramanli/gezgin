import { Module } from '@nestjs/common';
import { MediaModule } from '@/modules/media/media.module';
import { CommentsController, PostsController } from './posts.controller';
import { CommentsService } from './comments.service';
import { PostsService } from './posts.service';

@Module({
  imports: [MediaModule],
  controllers: [PostsController, CommentsController],
  providers: [PostsService, CommentsService],
  exports: [PostsService],
})
export class PostsModule {}
