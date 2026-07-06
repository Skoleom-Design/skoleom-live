import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from './api/users/user.entity';
import { Post } from './api/posts/post.entity';
import { Capsule } from './api/capsules/capsule.entity';
import { Order } from './api/orders/order.entity';
import { Boost } from './api/boosts/boost.entity';
import { PostsModule } from './api/posts/posts.module';
import { CapsulesModule } from './api/capsules/capsules.module';
import { OrdersModule } from './api/orders/orders.module';
import { BoostsModule } from './api/boosts/boosts.module';
import { PaymentsModule } from './api/payments/payments.module';
import { AdminModule } from './api/admin/admin.module';
import { AuthModule } from './api/auth/auth.module';
import { UsersModule } from './api/users/users.module';
import { FilesModule } from './api/files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'skoleom_live',
      entities: [User, Post, Capsule, Order, Boost],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
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
  ],
})
export class AppModule {}
