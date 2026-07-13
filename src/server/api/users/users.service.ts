import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserPlan } from '../../../shared/types/entities';

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

  async findPublicProfile(id: string): Promise<PublicProfile> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const { id: userId, username, displayName, avatarUrl, bio, isVerified, plan, createdAt } = user;
    return { id: userId, username, displayName, avatarUrl, bio, isVerified, plan, createdAt };
  }

  async updateProfile(
    userId: string,
    updates: { displayName?: string; avatarUrl?: string; bio?: string; plan?: UserPlan },
  ): Promise<PublicProfile> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    Object.assign(user, updates);
    await this.usersRepo.save(user);

    const { id, username, displayName, avatarUrl, bio, isVerified, plan, createdAt } = user;
    return { id, username, displayName, avatarUrl, bio, isVerified, plan, createdAt };
  }
}
