import {
  Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards,
} from '@nestjs/common';
import { CapsulesService, CreateCapsuleDto, CreateCapsuleGroupDto } from './capsules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('capsules')
export class CapsulesController {
  constructor(private readonly capsulesService: CapsulesService) {}

  @Get('post/:postId')
  getByPost(@Param('postId') postId: string) {
    return this.capsulesService.getByPost(postId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  getMine(@Request() req) {
    return this.capsulesService.getMine(req.user.id);
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
  @Post('groups')
  createGroup(@Request() req, @Body() dto: CreateCapsuleGroupDto) {
    return this.capsulesService.createGroup(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/attach')
  attach(@Param('id') id: string, @Body() body: { postId: string }, @Request() req) {
    return this.capsulesService.attachToPost(id, body.postId, req.user.id);
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
