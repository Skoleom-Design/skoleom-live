import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Boost } from './boost.entity';
import { BoostsService } from './boosts.service';
import { BoostsController } from './boosts.controller';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [TypeOrmModule.forFeature([Boost]), PostsModule],
  providers: [BoostsService],
  controllers: [BoostsController],
  exports: [BoostsService],
})
export class BoostsModule {}
