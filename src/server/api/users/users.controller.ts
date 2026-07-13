import { Controller, Get, Patch, Param, Body, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserPlan } from '../../../shared/types/entities';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @Request() req,
    @Body() dto: { displayName?: string; avatarUrl?: string; bio?: string; plan?: UserPlan },
  ) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Get(':id')
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.findPublicProfile(id);
  }
}
