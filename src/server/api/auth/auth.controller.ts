import { Controller, Post, Get, Body, Query, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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

  @Get('google')
  googleAuth(@Res() res: Response) {
    res.redirect(this.authService.getGoogleAuthUrl());
  }

  // Pas de guard ici — c'est Google qui redirige le navigateur vers cette route, sans notre
  // header Authorization. Voir InstagramController.callback pour le meme principe.
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.authService.handleGoogleCallback(code, state, error);
    res.redirect(redirectUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }
}
