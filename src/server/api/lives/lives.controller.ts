import {
  Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards,
} from '@nestjs/common';
import { LivesService } from './lives.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('lives')
export class LivesController {
  constructor(private readonly livesService: LivesService) {}

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
  @Post()
  start(@Request() req, @Body() body: { title?: string }) {
    return this.livesService.start(req.user.id, body.title);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.livesService.getById(id);
  }

  @Get(':id/comments')
  getComments(@Param('id') id: string) {
    return this.livesService.getComments(id);
  }

  @Get(':id/sales')
  getSales(@Param('id') id: string) {
    return this.livesService.getSales(id);
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
  @Post(':id/gift')
  sendGift(@Param('id') id: string, @Body() body: { giftType: string }, @Request() req) {
    return this.livesService.sendGift(id, req.user.id, body.giftType);
  }
}
