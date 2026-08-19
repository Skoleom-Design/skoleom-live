import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from './user.entity';
import { UserPlan } from '../../../shared/types/entities';
import { FollowsService } from '../follows/follows.service';

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isVerified: boolean;
  plan: UserPlan;
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  isVerified: boolean;
  plan: UserPlan;
  createdAt: Date;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private followsService: FollowsService,
  ) {}

  async search(q: string): Promise<UserSearchResult[]> {
    const query = q.trim();
    if (!query) return [];

    const users = await this.usersRepo.find({
      where: [{ username: ILike(`%${query}%`) }, { displayName: ILike(`%${query}%`) }],
      take: 20,
    });
    return users.map(({ id, username, displayName, avatarUrl, isVerified, plan }) => ({
      id, username, displayName, avatarUrl, isVerified, plan,
    }));
  }

  async findPublicProfile(id: string, viewerId?: string): Promise<PublicProfile> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const { id: userId, username, displayName, avatarUrl, bio, isVerified, plan, createdAt } = user;
    const [counts, isFollowing] = await Promise.all([
      this.followsService.getCounts(userId),
      viewerId && viewerId !== userId ? this.followsService.getStatus(viewerId, userId).then((s) => s.following) : Promise.resolve(undefined),
    ]);
    return {
      id: userId, username, displayName, avatarUrl, bio, isVerified, plan, createdAt,
      followersCount: counts.followers,
      followingCount: counts.following,
      isFollowing,
    };
  }

  async updateProfile(
    userId: string,
    updates: { username?: string; displayName?: string; avatarUrl?: string; bio?: string; plan?: UserPlan },
  ): Promise<PublicProfile> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Pas de contrainte unique en base sur username (voir register()) — meme verification manuelle ici.
    if (updates.username && updates.username !== user.username) {
      const taken = await this.usersRepo.findOne({ where: { username: updates.username } });
      if (taken) throw new ConflictException('Ce pseudo est déjà pris.');
    }

    Object.assign(user, updates);
    await this.usersRepo.save(user);

    const { id, username, displayName, avatarUrl, bio, isVerified, plan, createdAt } = user;
    return { id, username, displayName, avatarUrl, bio, isVerified, plan, createdAt };
  }

  async updateInterests(userId: string, interests: string[]): Promise<{ interests: string[]; hasOnboarded: boolean }> {
    await this.usersRepo.update(userId, { interests, hasOnboarded: true });
    return { interests, hasOnboarded: true };
  }

  // Suppression definitive et complete (pas de soft-delete) — transaction unique : si une
  // contrainte inattendue bloque une etape (ex: commande en cours sur une de ses capsules,
  // achetee par quelqu'un d'autre), tout est annule plutot que de laisser des donnees a moitie
  // supprimees. Nettoie dans l'ordre les tables filles avant les tables parentes pour ne
  // jamais violer une contrainte de cle etrangere.
  async deleteAccount(userId: string): Promise<void> {
    await this.usersRepo.manager.transaction(async (manager) => {
      const postIds = (await manager.query('SELECT id FROM posts WHERE "creatorId" = $1', [userId])).map((r: { id: string }) => r.id);
      const liveIds = (await manager.query('SELECT id FROM live_sessions WHERE "creatorId" = $1', [userId])).map((r: { id: string }) => r.id);
      const capsuleIds = (await manager.query('SELECT id FROM capsules WHERE "creatorId" = $1', [userId])).map((r: { id: string }) => r.id);
      const conversationIds = (await manager.query('SELECT id FROM conversations WHERE "userAId" = $1 OR "userBId" = $1', [userId])).map((r: { id: string }) => r.id);

      if (postIds.length) {
        await manager.query('DELETE FROM comments WHERE "postId" = ANY($1)', [postIds]);
        await manager.query('DELETE FROM boosts WHERE "postId" = ANY($1)', [postIds]);
        await manager.query('DELETE FROM notifications WHERE "postId" = ANY($1)', [postIds]);
      }

      if (liveIds.length) {
        await manager.query('DELETE FROM auction_bids WHERE "liveSessionId" = ANY($1)', [liveIds]);
        await manager.query('DELETE FROM gifts WHERE "liveSessionId" = ANY($1)', [liveIds]);
        await manager.query('DELETE FROM live_comments WHERE "liveSessionId" = ANY($1)', [liveIds]);
        await manager.query('DELETE FROM notifications WHERE "liveId" = ANY($1)', [liveIds]);
      }

      if (conversationIds.length) {
        await manager.query('DELETE FROM messages WHERE "conversationId" = ANY($1)', [conversationIds]);
        await manager.query('DELETE FROM conversations WHERE id = ANY($1)', [conversationIds]);
      }
      await manager.query('DELETE FROM follows WHERE "followerId" = $1 OR "followingId" = $1', [userId]);

      if (capsuleIds.length) {
        await manager.query('UPDATE live_sessions SET "featuredCapsuleId" = NULL WHERE "featuredCapsuleId" = ANY($1)', [capsuleIds]);
        await manager.query('UPDATE live_sessions SET "auctionCapsuleId" = NULL WHERE "auctionCapsuleId" = ANY($1)', [capsuleIds]);
      }

      // Cet utilisateur peut etre le plus offrant sur l'enchere de quelqu'un d'autre au moment
      // de la suppression — on ne supprime pas ce live (pas le sien), juste la reference.
      await manager.query('UPDATE live_sessions SET "currentBidderId" = NULL WHERE "currentBidderId" = $1', [userId]);

      await manager.query('DELETE FROM comments WHERE "userId" = $1', [userId]);
      await manager.query('DELETE FROM boosts WHERE "userId" = $1', [userId]);
      await manager.query('DELETE FROM gifts WHERE "senderId" = $1 OR "receiverId" = $1', [userId]);
      await manager.query('DELETE FROM auction_bids WHERE "bidderId" = $1', [userId]);
      await manager.query('DELETE FROM live_comments WHERE "userId" = $1', [userId]);
      // actorId est uuid, recipientId est varchar — caster actorId en text pour eviter
      // "operator does not exist: character varying = uuid" (Postgres ne peut pas typer $1
      // pour les deux colonnes a la fois sinon).
      await manager.query('DELETE FROM notifications WHERE "actorId"::text = $1 OR "recipientId" = $1', [userId]);
      await manager.query('DELETE FROM admin_action_logs WHERE "adminId" = $1', [userId]);
      await manager.query('DELETE FROM wallet_transactions WHERE "userId" = $1', [userId]);
      await manager.query('DELETE FROM orders WHERE "buyerId" = $1 OR "creatorId" = $1', [userId]);

      if (liveIds.length) await manager.query('DELETE FROM live_sessions WHERE id = ANY($1)', [liveIds]);
      if (capsuleIds.length) await manager.query('DELETE FROM capsules WHERE id = ANY($1)', [capsuleIds]);
      await manager.query('DELETE FROM capsule_groups WHERE "creatorId" = $1', [userId]);
      if (postIds.length) await manager.query('DELETE FROM posts WHERE id = ANY($1)', [postIds]);

      await manager.query('DELETE FROM users WHERE id = $1', [userId]);
    });
  }
}
