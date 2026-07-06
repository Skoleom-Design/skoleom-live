import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { PostStatus, BoostStatus } from '../../../shared/types/entities';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('commissions')
  getCommissions(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.getCommissions(Number(page), Number(limit));
  }

  @Get('boosts')
  getBoosts(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: BoostStatus,
  ) {
    return this.adminService.getBoosts(Number(page), Number(limit), status);
  }

  @Get('top-creators')
  getTopCreators(@Query('limit') limit = 10) {
    return this.adminService.getTopCreators(Number(limit));
  }

  @Patch('posts/:id/moderate')
  moderatePost(@Param('id') id: string, @Body() body: { status: PostStatus }) {
    return this.adminService.moderatePost(id, body.status);
  }
}
