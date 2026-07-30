import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { Boost } from '../boosts/boost.entity';
import { User } from '../users/user.entity';
import { Post } from '../posts/post.entity';
import { Gift } from '../lives/gift.entity';
import { LiveSession } from '../lives/live-session.entity';
import { WalletTransaction } from '../payments/wallet-transaction.entity';
import { BoostsModule } from '../boosts/boosts.module';
import { AdminActionLog } from './admin-action-log.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Boost, User, Post, Gift, LiveSession, AdminActionLog, WalletTransaction]),
    BoostsModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
