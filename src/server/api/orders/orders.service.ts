import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { Gift } from '../lives/gift.entity';
import { OrderStatus } from '../../../shared/types/entities';

export interface BuyerStats {
  totalSpent: number;
  capsulesBought: number;
  giftsSent: number;
  giftsSentAmount: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(Gift)
    private giftsRepo: Repository<Gift>,
  ) {}

  async getForUser(userId: string): Promise<{ purchases: Order[]; sales: Order[] }> {
    const [purchases, sales] = await Promise.all([
      this.ordersRepo.find({
        where: { buyerId: userId },
        relations: ['capsule', 'creator'],
        order: { createdAt: 'DESC' },
      }),
      this.ordersRepo.find({
        where: { creatorId: userId },
        relations: ['capsule', 'buyer'],
        order: { createdAt: 'DESC' },
      }),
    ]);
    return { purchases, sales };
  }

  async getBuyerStats(userId: string): Promise<BuyerStats> {
    const purchases = await this.ordersRepo.find({
      where: { buyerId: userId },
    });
    const paidPurchases = purchases.filter((o) => o.status !== OrderStatus.PENDING);

    const gifts = await this.giftsRepo.find({ where: { senderId: userId } });

    return {
      totalSpent:
        paidPurchases.reduce((sum, o) => sum + Number(o.amount), 0) +
        gifts.reduce((sum, g) => sum + Number(g.amount), 0),
      capsulesBought: paidPurchases.length,
      giftsSent: gifts.length,
      giftsSentAmount: gifts.reduce((sum, g) => sum + Number(g.amount), 0),
    };
  }
}
