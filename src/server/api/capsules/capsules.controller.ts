import {
  Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards,
} from '@nestjs/common';
import { CapsulesService, CreateCapsuleDto } from './capsules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('capsules')
export class CapsulesController {
  constructor(private readonly capsulesService: CapsulesService) {}

  @Get('post/:postId')
  getByPost(@Param('postId') postId: string) {
    return this.capsulesService.getByPost(postId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.capsulesService.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req, @Body() dto: CreateCapsuleDto) {
    return this.capsulesService.create(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Request() req, @Body() dto: Partial<CreateCapsuleDto>) {
    return this.capsulesService.update(id, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  archive(@Param('id') id: string, @Request() req) {
    return this.capsulesService.archive(id, req.user.id);
  }
}
