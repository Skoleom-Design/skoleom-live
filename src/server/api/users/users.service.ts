import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from './user.entity';
import { UserPlan } from '../../../shared/types/entities';

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
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
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

  async findPublicProfile(id: string): Promise<PublicProfile> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const { id: userId, username, displayName, avatarUrl, bio, isVerified, plan, createdAt } = user;
    return { id: userId, username, displayName, avatarUrl, bio, isVerified, plan, createdAt };
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
}
