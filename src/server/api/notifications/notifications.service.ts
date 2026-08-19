import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationType } from '../../../shared/types/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
    private realtimeGateway: RealtimeGateway,
  ) {}

  // Jamais de notif pour sa propre action (ex: liker/commenter son propre post, ou se suivre
  // soi-meme — deja bloque plus haut mais gardé ici par sécurité).
  async notify(
    recipientId: string,
    actorId: string,
    type: NotificationType,
    refs?: { postId?: string; liveId?: string },
  ): Promise<void> {
    if (recipientId === actorId) return;
    const saved = await this.notificationsRepo.save(
      this.notificationsRepo.create({
        recipientId,
        actorId,
        type,
        postId: refs?.postId ?? null,
        liveId: refs?.liveId ?? null,
      }),
    );
    // Recharge avec les relations (actor/post/live) pour que le payload poussé en temps reel
    // soit directement affichable sans requête supplémentaire côté client.
    const full = await this.notificationsRepo.findOne({ where: { id: saved.id }, relations: ['post', 'live'] });
    this.realtimeGateway.emitToUser(recipientId, 'notification', full);
  }

  // Notifie chaque abonne d'un createur qu'il vient de poster ou de passer en live — appele
  // par PostsService.create()/LivesService.start() apres coup, jamais bloquant pour l'action
  // elle-meme (voir les appels .catch() cote appelant).
  async notifyMany(recipientIds: string[], actorId: string, type: NotificationType, refs?: { postId?: string; liveId?: string }): Promise<void> {
    await Promise.all(recipientIds.map((recipientId) => this.notify(recipientId, actorId, type, refs)));
  }

  async getForUser(userId: string): Promise<Notification[]> {
    return this.notificationsRepo.find({
      where: { recipientId: userId },
      relations: ['post', 'live'],
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
