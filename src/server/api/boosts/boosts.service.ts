import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Boost } from './boost.entity';
import { BoostStatus, BoostObjective } from '../../../shared/types/entities';
import { PostsService } from '../posts/posts.service';

export interface CreateBoostDto {
  postId: string;
  objective: BoostObjective;
  budget: number;
  currency?: string;
  durationDays: number;
}

@Injectable()
export class BoostsService {
  constructor(
    @InjectRepository(Boost)
    private boostsRepo: Repository<Boost>,
    private postsService: PostsService,
  ) {}

  async create(userId: string, dto: CreateBoostDto): Promise<Boost> {
    const boost = this.boostsRepo.create({ ...dto, userId, currency: dto.currency || 'EUR' });
    return this.boostsRepo.save(boost);
  }

  async getByUser(userId: string): Promise<Boost[]> {
    return this.boostsRepo.find({
      where: { userId },
      relations: ['post'],
      order: { createdAt: 'DESC' },
    });
  }

  async activate(boostId: string): Promise<void> {
    const boost = await this.boostsRepo.findOne({ where: { id: boostId } });
    if (!boost) throw new NotFoundException('Boost not found');

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + boost.durationDays);

    await this.boostsRepo.update(boostId, {
      status: BoostStatus.ACTIVE,
      startedAt: new Date(),
      endedAt: endDate,
    });

    const boostScore = Math.floor(boost.budget * 10);
    await this.postsService.incrementBoostScore(boost.postId, boostScore);
  }

  async trackImpression(boostId: string): Promise<void> {
    await this.boostsRepo.increment({ id: boostId }, 'impressions', 1);
  }

  async expireFinishedBoosts(): Promise<void> {
    const now = new Date();
    const expired = await this.boostsRepo.find({
      where: { status: BoostStatus.ACTIVE, endedAt: LessThan(now) },
    });

    for (const boost of expired) {
      await this.boostsRepo.update(boost.id, { status: BoostStatus.COMPLETED });
    }
  }
}
