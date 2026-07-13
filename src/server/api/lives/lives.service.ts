import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LiveSession } from './live-session.entity';
import { LiveComment } from './live-comment.entity';
import { Gift } from './gift.entity';
import { Capsule } from '../capsules/capsule.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { LiveStatus, OrderStatus } from '../../../shared/types/entities';

// Catalogue des cadeaux virtuels — doit rester aligné avec GIFTS dans src/pages/live.tsx.
export const GIFT_CATALOG: Record<string, number> = {
  rose: 0.10,
  etoile: 0.50,
  feu: 1.50,
  coeur: 2,
  rocket: 5,
  diamant: 10,
  trophee: 15,
  couronne: 20,
};

@Injectable()
export class LivesService {
  constructor(
    @InjectRepository(LiveSession)
    private livesRepo: Repository<LiveSession>,
    @InjectRepository(LiveComment)
    private commentsRepo: Repository<LiveComment>,
    @InjectRepository(Gift)
    private giftsRepo: Repository<Gift>,
    @InjectRepository(Capsule)
    private capsulesRepo: Repository<Capsule>,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async start(creatorId: string, title?: string): Promise<LiveSession> {
    const existing = await this.livesRepo.findOne({ where: { creatorId, status: LiveStatus.LIVE } });
    if (existing) throw new BadRequestException('Un live est déjà en cours sur ce compte.');

    const live = this.livesRepo.create({
      creatorId,
      title,
      status: LiveStatus.LIVE,
      startedAt: new Date(),
    });
    return this.livesRepo.save(live);
  }

  async end(id: string, creatorId: string): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id, creatorId } });
    if (!live) throw new NotFoundException('Live introuvable');

    live.status = LiveStatus.ENDED;
    live.endedAt = new Date();
    return this.livesRepo.save(live);
  }

  async getActive(): Promise<LiveSession[]> {
    return this.livesRepo.find({
      where: { status: LiveStatus.LIVE },
      order: { startedAt: 'DESC' },
    });
  }

  async getMine(creatorId: string): Promise<LiveSession | null> {
    return this.livesRepo.findOne({
      where: { creatorId, status: LiveStatus.LIVE },
      relations: ['capsules'],
    });
  }

  async getById(id: string): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id }, relations: ['capsules'] });
    if (!live) throw new NotFoundException('Live introuvable');
    return live;
  }

  async addCapsule(liveId: string, capsuleId: string, creatorId: string): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id: liveId, creatorId }, relations: ['capsules'] });
    if (!live) throw new NotFoundException('Live introuvable');

    const capsule = await this.capsulesRepo.findOne({ where: { id: capsuleId, creatorId } });
    if (!capsule) throw new NotFoundException('Capsule introuvable');

    if (!live.capsules.some((c) => c.id === capsuleId)) {
      live.capsules.push(capsule);
      await this.livesRepo.save(live);
    }
    return live;
  }

  async removeCapsule(liveId: string, capsuleId: string, creatorId: string): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id: liveId, creatorId }, relations: ['capsules'] });
    if (!live) throw new NotFoundException('Live introuvable');

    live.capsules = live.capsules.filter((c) => c.id !== capsuleId);
    await this.livesRepo.save(live);
    return live;
  }

  async getSales(liveId: string): Promise<{ count: number; revenue: number }> {
    const live = await this.livesRepo.findOne({ where: { id: liveId }, relations: ['capsules'] });
    if (!live) throw new NotFoundException('Live introuvable');
    if (live.capsules.length === 0 || !live.startedAt) return { count: 0, revenue: 0 };

    const orders = await this.ordersRepo.find({
      where: {
        capsuleId: In(live.capsules.map((c) => c.id)),
        status: OrderStatus.PAID,
      },
    });

    const windowEnd = live.endedAt ?? new Date();
    const inWindow = orders.filter(
      (o) => o.createdAt >= live.startedAt && o.createdAt <= windowEnd,
    );

    return {
      count: inWindow.length,
      revenue: inWindow.reduce((sum, o) => sum + Number(o.creatorAmount), 0),
    };
  }

  async addComment(liveId: string, userId: string, text: string): Promise<LiveComment> {
    const comment = this.commentsRepo.create({ liveSessionId: liveId, userId, text });
    return this.commentsRepo.save(comment);
  }

  async getComments(liveId: string): Promise<LiveComment[]> {
    return this.commentsRepo.find({
      where: { liveSessionId: liveId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.commentsRepo.delete(commentId);
  }

  async isOwner(liveId: string, userId: string): Promise<boolean> {
    const live = await this.livesRepo.findOne({ where: { id: liveId } });
    return live?.creatorId === userId;
  }

  async sendGift(liveId: string, senderId: string, giftType: string): Promise<{ walletBalance: number }> {
    const live = await this.livesRepo.findOne({ where: { id: liveId } });
    if (!live) throw new NotFoundException('Live introuvable');
    if (live.creatorId === senderId) throw new BadRequestException('Tu ne peux pas t\'envoyer un cadeau à toi-même');

    const amount = GIFT_CATALOG[giftType];
    if (!amount) throw new BadRequestException('Cadeau inconnu');

    const sender = await this.usersRepo.findOne({ where: { id: senderId } });
    if (!sender || Number(sender.walletBalance) < amount) {
      throw new BadRequestException('Solde insuffisant');
    }

    const creatorAmount = Math.round(amount * 0.5 * 100) / 100;
    const platformAmount = Math.round((amount - creatorAmount) * 100) / 100;

    await this.usersRepo.decrement({ id: senderId }, 'walletBalance', amount);
    await this.usersRepo.increment({ id: live.creatorId }, 'walletBalance', creatorAmount);
    await this.usersRepo.increment({ id: live.creatorId }, 'totalEarnings', creatorAmount);

    await this.giftsRepo.save(this.giftsRepo.create({
      giftType,
      senderId,
      receiverId: live.creatorId,
      liveSessionId: liveId,
      amount,
      creatorAmount,
      platformAmount,
    }));

    const updated = await this.usersRepo.findOne({ where: { id: senderId } });
    return { walletBalance: Number(updated!.walletBalance) };
  }
}
