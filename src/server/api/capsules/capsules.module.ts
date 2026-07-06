import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Capsule } from './capsule.entity';
import { CapsulesService } from './capsules.service';
import { CapsulesController } from './capsules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Capsule])],
  providers: [CapsulesService],
  controllers: [CapsulesController],
  exports: [CapsulesService],
})
export class CapsulesModule {}
