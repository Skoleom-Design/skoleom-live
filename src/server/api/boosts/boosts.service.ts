import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, LessThan, In } from 'typeorm';
import { Boost } from './boost.entity';
import { BoostStatus, BoostObjective, BoostScope } from '../../../shared/types/entities';
import { PostsService } from '../posts/posts.service';

// Tarifs fixes par palier de durée — le client ne choisit plus librement son budget.
export const BOOST_PRICING: Record<BoostScope, Record<number, number>> = {
  [BoostScope.POST]: { 1: 4.99, 3: 12.99, 7: 24.99, 30: 79.99 },
  [BoostScope.ACCOUNT]: { 1: 12.99, 3: 29.99, 7: 59.99, 30: 199.99 },
};

export interface CreateBoostDto {
  scope: BoostScope;
  postId?: string;
  objective?: BoostObjective;
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

  getPricing() {
    return BOOST_PRICING;
  }

  async create(userId: string, dto: CreateBoostDto): Promise<Boost> {
    const scope = dto.scope || BoostScope.POST;
    if (scope === BoostScope.POST && !dto.postId) {
      throw new BadRequestException('postId requis pour booster un post');
    }

    // Un post (ou un compte) deja boosté ne doit pas pouvoir etre re-boosté par-dessus tant que
    // le boost en cours n'est pas termine/annulé — deux boosts actifs superposes sur la meme
    // cible n'a pas de sens (double incrementation du boostScore pour le meme effet, double
    // facturation).
    const existing = await this.boostsRepo.findOne({
      where: scope === BoostScope.POST
        ? { postId: dto.postId, status: In([BoostStatus.PENDING, BoostStatus.ACTIVE]) }
        : { userId, scope: BoostScope.ACCOUNT, status: In([BoostStatus.PENDING, BoostStatus.ACTIVE]) },
    });
    if (existing) {
      throw new BadRequestException(
        scope === BoostScope.POST
          ? "Ce post a déjà un boost en cours — attends qu'il se termine avant d'en relancer un."
          : "Ton compte a déjà un boost en cours — attends qu'il se termine avant d'en relancer un.",
      );
    }

    const price = BOOST_PRICING[scope][dto.durationDays];
    if (!price) throw new BadRequestException('Durée de boost invalide');

    const boost = this.boostsRepo.create({
      scope,
      postId: scope === BoostScope.POST ? dto.postId : undefined,
      objective: dto.objective,
      durationDays: dto.durationDays,
      budget: price,
      currency: dto.currency || 'EUR',
      userId,
    });
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
    if (boost.scope === BoostScope.ACCOUNT) {
      await this.postsService.boostAllByCreator(boost.userId, boostScore);
    } else {
      await this.postsService.incrementBoostScore(boost.postId, boostScore);
    }
  }

  async trackImpression(boostId: string): Promise<void> {
    await this.boostsRepo.increment({ id: boostId }, 'impressions', 1);
  }

  async cancel(boostId: string): Promise<void> {
    const boost = await this.boostsRepo.findOne({ where: { id: boostId } });
    if (!boost) throw new NotFoundException('Boost not found');
    if (boost.status === BoostStatus.COMPLETED || boost.status === BoostStatus.CANCELLED) {
      throw new BadRequestException('Ce boost est déjà terminé ou annulé.');
    }

    if (boost.status === BoostStatus.ACTIVE) {
      const boostScore = Math.floor(boost.budget * 10);
      if (boost.scope === BoostScope.ACCOUNT) {
        await this.postsService.unboostAllByCreator(boost.userId, boostScore);
      } else if (boost.postId) {
        await this.postsService.decrementBoostScore(boost.postId, boostScore);
      }
    }

    await this.boostsRepo.update(boostId, { status: BoostStatus.CANCELLED, endedAt: new Date() });
  }

  // Sans ce cron, un boost ACTIVE ne repassait jamais à COMPLETED une fois sa durée écoulée —
  // rien dans le code n'appelait cette méthode.
  @Cron(CronExpression.EVERY_10_MINUTES)
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
