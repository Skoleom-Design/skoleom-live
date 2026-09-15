import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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

  // Resout une URL de preview fraiche pour un morceau deja choisi — les URLs Deezer expirent
  // au bout de ~15min, jamais fiable de reutiliser celle recue lors de la recherche initiale.
  @Get('track/:id')
  getTrack(@Param('id') id: string) {
    return this.musicService.getTrack(id);
  }
}
