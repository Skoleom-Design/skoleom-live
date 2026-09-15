import { Module } from '@nestjs/common';
import { MusicService } from './music.service';
import { MusicController } from './music.controller';

@Module({
  providers: [MusicService],
  controllers: [MusicController],
})
export class MusicModule {}
