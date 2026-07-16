import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { User } from './api/users/user.entity';
import { Post } from './api/posts/post.entity';
import { Comment } from './api/posts/comment.entity';
import { Capsule } from './api/capsules/capsule.entity';
import { Order } from './api/orders/order.entity';
import { Boost } from './api/boosts/boost.entity';
import { LiveSession } from './api/lives/live-session.entity';
import { LiveComment } from './api/lives/live-comment.entity';
import { Gift } from './api/lives/gift.entity';
import { AdminActionLog } from './api/admin/admin-action-log.entity';
import { PostsModule } from './api/posts/posts.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    process.env.DB_HOST
      ? TypeOrmModule.forRoot({
          type: 'mysql',
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || '3306'),
          username: process.env.DB_USERNAME || 'root',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'skoleom_live',
          entities: [User, Post, Comment, Capsule, Order, Boost, LiveSession, LiveComment, Gift, AdminActionLog],
          synchronize: process.env.NODE_ENV !== 'production',
          logging: process.env.NODE_ENV === 'development',
        })
      : TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: 'skoleom-live.sqlite',
          entities: [User, Post, Comment, Capsule, Order, Boost, LiveSession, LiveComment, Gift, AdminActionLog],
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
  ],
})
export class AppModule {}
