import { Controller, Post, Delete, Get, Param, Request, UseGuards } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId')
  follow(@Request() req, @Param('userId') userId: string) {
    return this.followsService.follow(req.user.id, userId);
  }

  @Delete(':userId')
  unfollow(@Request() req, @Param('userId') userId: string) {
    return this.followsService.unfollow(req.user.id, userId);
  }

  @Get(':userId/status')
  status(@Request() req, @Param('userId') userId: string) {
    return this.followsService.getStatus(req.user.id, userId);
  }
}
