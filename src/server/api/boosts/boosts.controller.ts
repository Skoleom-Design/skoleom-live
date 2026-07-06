import {
  Controller, Get, Post, Body, Request, UseGuards,
} from '@nestjs/common';
import { BoostsService, CreateBoostDto } from './boosts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('boosts')
export class BoostsController {
  constructor(private readonly boostsService: BoostsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyBoosts(@Request() req) {
    return this.boostsService.getByUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req, @Body() dto: CreateBoostDto) {
    return this.boostsService.create(req.user.id, dto);
  }
}
