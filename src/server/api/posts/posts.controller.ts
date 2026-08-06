import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { PostsService, CreatePostDto } from './posts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { UserRole, PostType } from '../../../shared/types/entities';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('feed')
  getFeed(@Query() query: { page?: number; limit?: number }, @Request() req) {
    return this.postsService.getFeed({ ...query, userId: req.user?.id });
  }

  @UseGuards(JwtAuthGuard)
  @Get('liked/me')
  getLiked(@Request() req) {
    return this.postsService.getLikedByUser(req.user.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  getById(@Param('id') id: string, @Request() req) {
    return this.postsService.getById(id, req.user?.id);
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
    return this.postsService.delete(id, req.user.id, req.user.role === UserRole.ADMIN);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { caption?: string; tags?: string[]; mediaUrl?: string; thumbnailUrl?: string; type?: PostType },
  ) {
    return this.postsService.update(id, req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  toggleLike(@Param('id') id: string, @Request() req) {
    return this.postsService.toggleLike(id, req.user.id);
  }

  @Post(':id/share')
  incrementShare(@Param('id') id: string) {
    return this.postsService.incrementShare(id);
  }

  @Get(':id/comments')
  getComments(@Param('id') id: string) {
    return this.postsService.getComments(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  addComment(@Param('id') id: string, @Body() body: { text: string }, @Request() req) {
    return this.postsService.addComment(id, req.user.id, body.text);
  }
}
