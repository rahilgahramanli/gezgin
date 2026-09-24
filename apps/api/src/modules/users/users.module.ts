import { Module } from '@nestjs/common';
import { PostsModule } from '@/modules/posts/posts.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PostsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
