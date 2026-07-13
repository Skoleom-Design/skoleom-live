import { Controller, Post, Get, Body, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserPlan } from '../../../shared/types/entities';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: { email: string; username: string; password: string; plan?: UserPlan }) {
    return this.authService.register(body.email, body.username, body.password, body.plan);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    // "email" accepte aussi un nom d'utilisateur (ex: le compte admin se connecte via son pseudo).
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }
}
