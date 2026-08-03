import {
  Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards,
} from '@nestjs/common';
import { LivesService } from './lives.service';
import { LivesGateway } from './lives.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('lives')
export class LivesController {
  constructor(
    private readonly livesService: LivesService,
    private readonly livesGateway: LivesGateway,
  ) {}

  @Get('active')
  getActive() {
    return this.livesService.getActive();
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  getMine(@Request() req) {
    return this.livesService.getMine(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine/count')
  async getMyLivesCount(@Request() req) {
    return { count: await this.livesService.countByCreator(req.user.id) };
  }

  // Consulte cote client avant meme de cliquer "Démarrer" (voir studio/live.tsx) pour afficher
  // le decompte "Tu pourras relancer un live dans Xs" plutot que de le decouvrir a l'echec.
  @UseGuards(JwtAuthGuard)
  @Get('cooldown')
  async getCooldown(@Request() req) {
    return { remainingSeconds: await this.livesService.getRestartCooldownSeconds(req.user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  start(@Request() req, @Body() body: { title?: string; mode?: 'live' | 'auction' }) {
    if (body.mode === 'auction') {
      return this.livesService.startAuction(req.user.id, body.title);
    }
    return this.livesService.start(req.user.id, body.title);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/auction')
  async launchAuction(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { capsuleId: string; startingBid: number; durationSeconds: number },
  ) {
    const live = await this.livesService.launchCapsuleAuction(id, req.user.id, {
      capsuleId: body.capsuleId,
      startingBid: Number(body.startingBid),
      durationSeconds: Number(body.durationSeconds),
    });
    this.livesGateway.broadcastAuctionStarted(id, live);
    return live;
  }

  // Route statique déclarée avant les routes dynamiques ':id' — utilisée par les pages vitrine
  // /live et /enchere (créateurs fictifs, aucun vrai live/destinataire à créditer).
  @UseGuards(JwtAuthGuard)
  @Post('gift/demo')
  sendDemoGift(@Request() req, @Body() body: { giftType: string }) {
    return this.livesService.sendDemoGift(req.user.id, body.giftType);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.livesService.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/livekit-token')
  getLiveKitToken(@Param('id') id: string, @Request() req) {
    return this.livesService.getLiveKitToken(id, req.user.id);
  }

  @Get(':id/comments')
  getComments(@Param('id') id: string) {
    return this.livesService.getComments(id);
  }

  @Get(':id/bids')
  getBids(@Param('id') id: string) {
    return this.livesService.getBidHistory(id);
  }

  @Get(':id/sales')
  getSales(@Param('id') id: string) {
    return this.livesService.getSales(id);
  }

  @Get(':id/top-donors')
  getTopDonors(@Param('id') id: string) {
    return this.livesService.getTopDonors(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/end')
  end(@Param('id') id: string, @Request() req) {
    return this.livesService.end(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/capsules')
  addCapsule(@Param('id') id: string, @Body() body: { capsuleId: string }, @Request() req) {
    return this.livesService.addCapsule(id, body.capsuleId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/capsules/:capsuleId')
  removeCapsule(@Param('id') id: string, @Param('capsuleId') capsuleId: string, @Request() req) {
    return this.livesService.removeCapsule(id, capsuleId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/featured')
  async setFeatured(@Param('id') id: string, @Body() body: { capsuleId: string | null }, @Request() req) {
    const live = await this.livesService.setFeaturedCapsule(id, req.user.id, body.capsuleId);
    this.livesGateway.broadcastFeaturedCapsule(id, live);
    return live;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/gift')
  async sendGift(@Param('id') id: string, @Body() body: { giftType: string }, @Request() req) {
    const result = await this.livesService.sendGift(id, req.user.id, body.giftType);
    this.livesGateway.broadcastGift(id, {
      giftType: body.giftType,
      username: result.senderUsername,
      displayName: result.senderDisplayName,
    });
    return { walletBalance: result.walletBalance };
  }
}
