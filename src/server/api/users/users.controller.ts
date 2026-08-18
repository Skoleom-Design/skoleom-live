import { Controller, Get, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserPlan } from '../../../shared/types/entities';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Route statique déclarée avant ':id' — sinon Nest matcherait "search" comme un id.
  @Get('search')
  search(@Query('q') q: string) {
    return this.usersService.search(q || '');
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @Request() req,
    @Body() dto: { username?: string; displayName?: string; avatarUrl?: string; bio?: string; plan?: UserPlan },
  ) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  // Appelé à la fin de l'onboarding (choix des centres d'intérêt) ou au "Passer" — dans les
  // deux cas hasOnboarded passe à true pour ne plus jamais réafficher l'écran, interests peut
  // rester vide si l'utilisateur a sauté l'étape.
  @UseGuards(JwtAuthGuard)
  @Patch('me/interests')
  updateInterests(@Request() req, @Body() dto: { interests: string[] }) {
    return this.usersService.updateInterests(req.user.id, dto.interests || []);
  }

  @Get(':id')
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.findPublicProfile(id);
  }
}
