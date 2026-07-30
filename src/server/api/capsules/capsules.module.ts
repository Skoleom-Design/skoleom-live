import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Capsule } from './capsule.entity';
import { CapsuleGroup } from './capsule-group.entity';
import { User } from '../users/user.entity';
import { CapsulesService } from './capsules.service';
import { CapsulesController } from './capsules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Capsule, CapsuleGroup, User])],
  providers: [CapsulesService],
  controllers: [CapsulesController],
  exports: [CapsulesService],
})
export class CapsulesModule {}
