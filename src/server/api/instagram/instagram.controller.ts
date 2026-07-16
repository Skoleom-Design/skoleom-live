import {
  Controller, Get, Post, Query, Body, Request, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { InstagramService } from './instagram.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('instagram')
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @UseGuards(JwtAuthGuard)
  @Post('authorize')
  authorize(@Request() req) {
    return { authorizeUrl: this.instagramService.getAuthorizeUrl(req.user.id) };
  }

  // Pas de guard ici — c'est Instagram qui redirige le navigateur vers cette route,
  // sans notre header Authorization. L'utilisateur est identifie via le `state` signe.
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.instagramService.handleCallback(code, state, error);
    res.redirect(redirectUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@Request() req) {
    return this.instagramService.getStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  disconnect(@Request() req) {
    return this.instagramService.disconnect(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('media')
  listMedia(@Request() req) {
    return this.instagramService.listMedia(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('import')
  importMedia(@Request() req, @Body() body: { mediaIds: string[] }) {
    return this.instagramService.importMedia(req.user.id, body.mediaIds);
  }
}
