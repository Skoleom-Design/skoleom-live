import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './post.entity';
import { PostStatus, PostType } from '../../../shared/types/entities';

export interface CreatePostDto {
  caption?: string;
  type: PostType;
  mediaUrl: string;
  thumbnailUrl?: string;
  tags?: string[];
  musicName?: string;
  musicUrl?: string;
}

export interface FeedQuery {
  page?: number;
  limit?: number;
  userId?: string;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postsRepo: Repository<Post>,
  ) {}

  async getFeed(query: FeedQuery): Promise<{ posts: Post[]; total: number }> {
    const { page = 1, limit = 20 } = query;

    const [posts, total] = await this.postsRepo.findAndCount({
      where: { status: PostStatus.ACTIVE },
      relations: ['creator', 'capsules'],
      order: {
        boostScore: 'DESC',
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { posts, total };
  }

  async getById(id: string): Promise<Post> {
    const post = await this.postsRepo.findOne({
      where: { id },
      relations: ['creator', 'capsules', 'boosts'],
    });
    if (!post) throw new NotFoundException('Post not found');

    await this.postsRepo.increment({ id }, 'viewCount', 1);
    return post;
  }

  async create(creatorId: string, dto: CreatePostDto): Promise<Post> {
    const post = this.postsRepo.create({ ...dto, creatorId });
    return this.postsRepo.save(post);
  }

  async delete(id: string, creatorId: string): Promise<void> {
    const post = await this.postsRepo.findOne({ where: { id, creatorId } });
    if (!post) throw new NotFoundException('Post not found');
    await this.postsRepo.update(id, { status: PostStatus.ARCHIVED });
  }

  async incrementBoostScore(postId: string, score: number): Promise<void> {
    await this.postsRepo.increment({ id: postId }, 'boostScore', score);
    await this.postsRepo.update(postId, { isBoosted: true });
  }

  async getByCreator(creatorId: string): Promise<Post[]> {
    return this.postsRepo.find({
      where: { creatorId, status: PostStatus.ACTIVE },
      relations: ['capsules'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAnalytics(creatorId: string): Promise<{
    posts: (Post & { totalSold: number; revenue: number; engagementRate: number })[];
    totals: { views: number; likes: number; sold: number; revenue: number };
  }> {
    const posts = await this.postsRepo.find({
      where: { creatorId, status: PostStatus.ACTIVE },
      relations: ['capsules'],
      order: { viewCount: 'DESC' },
    });

    let totalViews = 0, totalLikes = 0, totalSold = 0, totalRevenue = 0;

    const enriched = posts.map((post) => {
      const sold = post.capsules.reduce((s, c) => s + c.soldCount, 0);
      const revenue = post.capsules.reduce((s, c) => s + c.price * c.soldCount * (1 - c.commissionRate / 100), 0);
      const engagementRate = post.viewCount > 0 ? (post.likeCount / post.viewCount) * 100 : 0;

      totalViews += post.viewCount;
      totalLikes += post.likeCount;
      totalSold += sold;
      totalRevenue += revenue;

      return { ...post, totalSold: sold, revenue, engagementRate };
    });

    return {
      posts: enriched,
      totals: { views: totalViews, likes: totalLikes, sold: totalSold, revenue: totalRevenue },
    };
  }
}
