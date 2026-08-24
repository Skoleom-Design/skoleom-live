import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { User } from './api/users/user.entity';
import { Post } from './api/posts/post.entity';
import { Comment } from './api/posts/comment.entity';
import { Capsule } from './api/capsules/capsule.entity';
import { CapsuleGroup } from './api/capsules/capsule-group.entity';
import { Order } from './api/orders/order.entity';
import { Boost } from './api/boosts/boost.entity';
import { LiveSession } from './api/lives/live-session.entity';
import { LiveGuest } from './api/lives/live-guest.entity';
import { LiveViewerAccess } from './api/lives/live-viewer-access.entity';
import { LiveComment } from './api/lives/live-comment.entity';
import { Gift } from './api/lives/gift.entity';
import { AuctionBid } from './api/lives/auction-bid.entity';
import { WalletTransaction } from './api/payments/wallet-transaction.entity';
import { AdminActionLog } from './api/admin/admin-action-log.entity';
import { Notification } from './api/notifications/notification.entity';
import { Follow } from './api/follows/follow.entity';
import { Conversation } from './api/messages/conversation.entity';
import { Message } from './api/messages/message.entity';
import { LoginLog } from './api/auth/login-log.entity';
import { PostsModule } from './api/posts/posts.module';
import { NotificationsModule } from './api/notifications/notifications.module';
import { CapsulesModule } from './api/capsules/capsules.module';
import { OrdersModule } from './api/orders/orders.module';
import { BoostsModule } from './api/boosts/boosts.module';
import { PaymentsModule } from './api/payments/payments.module';
import { AdminModule } from './api/admin/admin.module';
import { AuthModule } from './api/auth/auth.module';
import { UsersModule } from './api/users/users.module';
import { FilesModule } from './api/files/files.module';
import { LivesModule } from './api/lives/lives.module';
import { InstagramModule } from './api/instagram/instagram.module';
import { FollowsModule } from './api/follows/follows.module';
import { MessagesModule } from './api/messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    process.env.DB_HOST
      ? TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'skoleom_live',
          // Supabase (et la plupart des hebergeurs Postgres geres) exige TLS sur la connexion ;
          // rejectUnauthorized: false accepte leur certificat auto-signe / chaine non verifiee.
          ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
          entities: [User, Post, Comment, Capsule, CapsuleGroup, Order, Boost, LiveSession, LiveGuest, LiveViewerAccess, LiveComment, Gift, AuctionBid, WalletTransaction, AdminActionLog, Notification, Follow, Conversation, Message, LoginLog],
          synchronize: process.env.NODE_ENV !== 'production',
          logging: process.env.NODE_ENV === 'development',
        })
      : TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: 'skoleom-live.sqlite',
          entities: [User, Post, Comment, Capsule, CapsuleGroup, Order, Boost, LiveSession, LiveGuest, LiveViewerAccess, LiveComment, Gift, AuctionBid, WalletTransaction, AdminActionLog, Notification, Follow, Conversation, Message, LoginLog],
          synchronize: true,
        }),
    AuthModule,
    UsersModule,
    PostsModule,
    CapsulesModule,
    OrdersModule,
    BoostsModule,
    PaymentsModule,
    AdminModule,
    FilesModule,
    LivesModule,
    InstagramModule,
    NotificationsModule,
    FollowsModule,
    MessagesModule,
  ],
})
export class AppModule {}
