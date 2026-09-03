import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { PostStatus, BoostStatus, UserPlan, UserRole, BoostObjective } from '../../../shared/types/entities';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats(@Query('period') period?: 'day' | 'month' | 'quarter' | 'year') {
    return this.adminService.getDashboardStats(period);
  }

  @Get('commissions')
  getCommissions(@Query('page') page = 1, @Query('limit') limit = 20, @Query('search') search?: string) {
    return this.adminService.getCommissions(Number(page), Number(limit), search);
  }

  @Get('boosts')
  getBoosts(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: BoostStatus,
  ) {
    return this.adminService.getBoosts(Number(page), Number(limit), status);
  }

  @Get('users')
  getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'walletBalance' | 'totalEarnings' | 'username',
    @Query('sortDir') sortDir?: 'ASC' | 'DESC',
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
    @Query('plan') plan?: UserPlan,
    @Query('isOnline') isOnline?: string,
    @Query('trashed') trashed?: string,
  ) {
    return this.adminService.getUsers(
      Number(page),
      Number(limit),
      search,
      sortBy,
      sortDir,
      role,
      isActive === undefined || isActive === '' ? undefined : isActive === 'true',
      plan,
      isOnline === undefined || isOnline === '' ? undefined : isOnline === 'true',
      trashed === 'true',
    );
  }

  @Get('users/:id/detail')
  getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Get('posts')
  getPosts(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getPosts(Number(page), Number(limit), status, search);
  }

  @Get('top-creators-by-channel')
  getTopCreatorsByChannel(@Query('limit') limit = 10) {
    return this.adminService.getTopCreatorsByChannel(Number(limit));
  }

  @Get('top-donors')
  getTopDonors(@Query('limit') limit = 10) {
    return this.adminService.getTopDonors(Number(limit));
  }

  @Get('top-livers')
  getTopLivers(@Query('limit') limit = 10) {
    return this.adminService.getTopLivers(Number(limit));
  }

  @Get('top-posters')
  getTopPosters(@Query('limit') limit = 10) {
    return this.adminService.getTopPosters(Number(limit));
  }

  @Patch('posts/:id/moderate')
  moderatePost(@Param('id') id: string, @Body() body: { status: PostStatus }) {
    return this.adminService.moderatePost(id, body.status);
  }

  // Corbeille — supprime (soft) sans effacer les données, restaure, ou vide définitivement.
  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.adminService.deletePost(id);
  }

  @Patch('posts/:id/restore')
  restorePost(@Param('id') id: string) {
    return this.adminService.restorePost(id);
  }

  @Delete('posts/:id/permanent')
  permanentlyDeletePost(@Param('id') id: string) {
    return this.adminService.permanentlyDeletePost(id);
  }

  @Patch('users/:id/status')
  setUserActive(@Param('id') id: string, @Body() body: { isActive: boolean }, @Request() req) {
    return this.adminService.setUserActive(id, body.isActive, req.user.id);
  }

  // Corbeille — supprime (soft) sans effacer les donnees, restaure, ou vide definitivement.
  // Meme convention que posts/:id ci-dessus.
  @Delete('users/:id')
  trashUser(@Param('id') id: string, @Request() req) {
    return this.adminService.trashUser(id, req.user.id);
  }

  @Patch('users/:id/restore')
  restoreUser(@Param('id') id: string, @Request() req) {
    return this.adminService.restoreUser(id, req.user.id);
  }

  @Delete('users/:id/permanent')
  permanentlyDeleteUser(@Param('id') id: string, @Request() req) {
    return this.adminService.permanentlyDeleteUser(id, req.user.id);
  }

  @Patch('users/:id/plan')
  setUserPlan(@Param('id') id: string, @Body() body: { plan: UserPlan }, @Request() req) {
    return this.adminService.setUserPlan(id, body.plan, req.user.id);
  }

  @Post('users/:id/credit')
  creditWallet(@Param('id') id: string, @Body() body: { amount: number }, @Request() req) {
    return this.adminService.creditWallet(id, body.amount, req.user.id);
  }

  @Post('users/:id/boost')
  grantBoost(
    @Param('id') id: string,
    @Body() body: { durationDays: number; objective: BoostObjective },
    @Request() req,
  ) {
    return this.adminService.grantBoost(id, body.durationDays, body.objective, req.user.id);
  }

  @Patch('boosts/:id/cancel')
  cancelBoost(@Param('id') id: string, @Request() req) {
    return this.adminService.cancelBoost(id, req.user.id);
  }

  @Patch('boosts/:id/approve')
  approveBoost(@Param('id') id: string, @Request() req) {
    return this.adminService.approveBoost(id, req.user.id);
  }
}
