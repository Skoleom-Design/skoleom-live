import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationType } from '../../../shared/types/entities';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
  ) {}

  // Jamais de notif pour sa propre action (ex: liker/commenter son propre post).
  async notify(recipientId: string, actorId: string, type: NotificationType, postId?: string): Promise<void> {
    if (recipientId === actorId) return;
    await this.notificationsRepo.save(
      this.notificationsRepo.create({ recipientId, actorId, type, postId: postId ?? null }),
    );
  }

  async getForUser(userId: string): Promise<Notification[]> {
    return this.notificationsRepo.find({
      where: { recipientId: userId },
      relations: ['post'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepo.count({ where: { recipientId: userId, read: false } });
    return { count };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepo.update({ recipientId: userId, read: false }, { read: true });
  }
}
