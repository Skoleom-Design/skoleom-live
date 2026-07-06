import {
  Controller, Get, Post, Delete, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { PostsService, CreatePostDto } from './posts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('feed')
  getFeed(@Query() query: { page?: number; limit?: number }) {
    return this.postsService.getFeed(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.postsService.getById(id);
  }

  @Get('creator/:creatorId')
  getByCreator(@Param('creatorId') creatorId: string) {
    return this.postsService.getByCreator(creatorId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('analytics/me')
  getMyAnalytics(@Request() req) {
    return this.postsService.getAnalytics(req.user.id);
  }

  @Get('creator/:creatorId/analytics')
  getCreatorAnalytics(@Param('creatorId') creatorId: string) {
    return this.postsService.getAnalytics(creatorId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req, @Body() dto: CreatePostDto) {
    return this.postsService.create(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.postsService.delete(id, req.user.id);
  }
}
