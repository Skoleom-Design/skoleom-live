import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { InstagramService } from './instagram.service';
import { InstagramController } from './instagram.controller';
import { FilesModule } from '../files/files.module';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), FilesModule, PostsModule],
  providers: [InstagramService],
  controllers: [InstagramController],
})
export class InstagramModule {}
