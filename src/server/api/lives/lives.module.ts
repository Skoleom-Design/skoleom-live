import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { LiveSession } from './live-session.entity';
import { LiveComment } from './live-comment.entity';
import { Gift } from './gift.entity';
import { AuctionBid } from './auction-bid.entity';
import { Capsule } from '../capsules/capsule.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { WalletTransaction } from '../payments/wallet-transaction.entity';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowsModule } from '../follows/follows.module';
import { LivesService } from './lives.service';
import { LivesController } from './lives.controller';
import { LivesGateway } from './lives.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([LiveSession, LiveComment, Gift, AuctionBid, Capsule, Order, User, WalletTransaction]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev_secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    PaymentsModule,
    NotificationsModule,
    FollowsModule,
  ],
  providers: [LivesService, LivesGateway],
  controllers: [LivesController],
  exports: [LivesService],
})
export class LivesModule {}
