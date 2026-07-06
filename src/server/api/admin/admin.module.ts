import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { Boost } from '../boosts/boost.entity';
import { User } from '../users/user.entity';
import { Post } from '../posts/post.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Boost, User, Post])],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
