import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order } from '../orders/order.entity';
import { Boost } from '../boosts/boost.entity';
import { User } from '../users/user.entity';
import { Post } from '../posts/post.entity';
import { OrderStatus, BoostStatus, PostStatus } from '../../../shared/types/entities';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(Boost)
    private boostsRepo: Repository<Boost>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Post)
    private postsRepo: Repository<Post>,
  ) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalPosts,
      monthlyOrders,
      monthlyBoosts,
      pendingBoosts,
    ] = await Promise.all([
      this.usersRepo.count(),
      this.postsRepo.count({ where: { status: PostStatus.ACTIVE } }),
      this.ordersRepo.find({
        where: {
          status: OrderStatus.PAID,
          createdAt: Between(startOfMonth, now),
        },
      }),
      this.boostsRepo.find({
        where: { createdAt: Between(startOfMonth, now) },
      }),
      this.boostsRepo.count({ where: { status: BoostStatus.PENDING } }),
    ]);

    const monthlyGMV = monthlyOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    const monthlyCommissions = monthlyOrders.reduce((sum, o) => sum + Number(o.commissionAmount), 0);
    const monthlyBoostRevenue = monthlyBoosts.reduce((sum, b) => sum + Number(b.budget), 0);
    const totalRevenue = monthlyCommissions + monthlyBoostRevenue;

    return {
      totalUsers,
      totalPosts,
      monthlyGMV: monthlyGMV.toFixed(2),
      monthlyCommissions: monthlyCommissions.toFixed(2),
      monthlyBoostRevenue: monthlyBoostRevenue.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      pendingBoosts,
      ordersCount: monthlyOrders.length,
    };
  }

  async getCommissions(page = 1, limit = 20) {
    const [orders, total] = await this.ordersRepo.findAndCount({
      where: { status: OrderStatus.PAID },
      relations: ['buyer', 'capsule'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { orders, total, page, limit };
  }

  async getBoosts(page = 1, limit = 20, status?: BoostStatus) {
    const where = status ? { status } : {};
    const [boosts, total] = await this.boostsRepo.findAndCount({
      where,
      relations: ['user', 'post'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { boosts, total, page, limit };
  }

  async getTopCreators(limit = 10) {
    return this.usersRepo.find({
      order: { totalEarnings: 'DESC' },
      take: limit,
      select: ['id', 'username', 'displayName', 'avatarUrl', 'totalEarnings'],
    });
  }

  async moderatePost(postId: string, status: PostStatus): Promise<void> {
    await this.postsRepo.update(postId, { status });
  }
}
