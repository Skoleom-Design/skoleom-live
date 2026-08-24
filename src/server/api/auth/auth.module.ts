import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { LoginLog } from './login-log.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AdminSeedService } from './admin-seed.service';
import { MonetizerService } from '../integrations/monetizer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, LoginLog]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev_secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy, AdminSeedService, MonetizerService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
