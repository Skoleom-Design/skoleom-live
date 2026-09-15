import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MusicService } from './music.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @Get('search')
  search(@Query('q') q: string) {
    if (!q?.trim()) return [];
    return this.musicService.search(q.trim());
  }
}
