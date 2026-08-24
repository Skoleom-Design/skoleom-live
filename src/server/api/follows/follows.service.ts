import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './follow.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../../shared/types/entities';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private followsRepo: Repository<Follow>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async follow(followerId: string, followingId: string): Promise<{ following: boolean }> {
    if (followerId === followingId) throw new BadRequestException('Tu ne peux pas te suivre toi-même.');

    const target = await this.usersRepo.findOne({ where: { id: followingId } });
    if (!target) throw new NotFoundException('Utilisateur introuvable');

    const existing = await this.followsRepo.findOne({ where: { followerId, followingId } });
    if (!existing) {
      await this.followsRepo.save(this.followsRepo.create({ followerId, followingId }));
      await this.notificationsService.notify(followingId, followerId, NotificationType.FOLLOW);
    }
    return { following: true };
  }

  async unfollow(followerId: string, followingId: string): Promise<{ following: boolean }> {
    await this.followsRepo.delete({ followerId, followingId });
    return { following: false };
  }

  async getStatus(followerId: string, followingId: string): Promise<{ following: boolean }> {
    const existing = await this.followsRepo.findOne({ where: { followerId, followingId } });
    return { following: !!existing };
  }

  async getCounts(userId: string): Promise<{ followers: number; following: number }> {
    const [followers, following] = await Promise.all([
      this.followsRepo.count({ where: { followingId: userId } }),
      this.followsRepo.count({ where: { followerId: userId } }),
    ]);
    return { followers, following };
  }

  // Utilise pour le fan-out de notifications (nouveau post / live demarre) — voir
  // posts.service.ts et lives.service.ts.
  async getFollowerIds(userId: string): Promise<string[]> {
    const rows = await this.followsRepo.find({ where: { followingId: userId } });
    return rows.map((r) => r.followerId);
  }

  // Liste hydratee des comptes suivis par userId — meme forme que UserSearchResult (voir
  // users.service.ts) pour que le frontend reutilise le meme composant de liste que la
  // recherche par pseudo (voir LivesGateway/studio "inviter parmi mes abonnements").
  async getFollowingHydrated(userId: string): Promise<{ id: string; username: string; displayName: string; avatarUrl: string }[]> {
    const rows = await this.followsRepo
      .createQueryBuilder('follow')
      .innerJoin('follow.following', 'user')
      .select('user.id', 'id')
      .addSelect('user.username', 'username')
      .addSelect('user.displayName', 'displayName')
      .addSelect('user.avatarUrl', 'avatarUrl')
      .where('follow.followerId = :userId', { userId })
      .orderBy('user.username', 'ASC')
      .getRawMany();
    return rows;
  }
}
