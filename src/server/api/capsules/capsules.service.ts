import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Capsule } from './capsule.entity';
import { CapsuleStatus } from '../../../shared/types/entities';

export interface CreateCapsuleDto {
  postId: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  images?: string[];
  stock: number;
  variants?: { name: string; options: string[]; price?: number }[];
}

@Injectable()
export class CapsulesService {
  constructor(
    @InjectRepository(Capsule)
    private capsulesRepo: Repository<Capsule>,
  ) {}

  async getByPost(postId: string): Promise<Capsule[]> {
    return this.capsulesRepo.find({
      where: { postId, status: CapsuleStatus.AVAILABLE },
    });
  }

  async getById(id: string): Promise<Capsule> {
    const capsule = await this.capsulesRepo.findOne({
      where: { id },
      relations: ['post'],
    });
    if (!capsule) throw new NotFoundException('Capsule not found');
    return capsule;
  }

  async create(creatorId: string, dto: CreateCapsuleDto): Promise<Capsule> {
    const commissionRate = parseFloat(process.env.COMMISSION_RATE || '0.15') * 100;
    const capsule = this.capsulesRepo.create({
      ...dto,
      creatorId,
      commissionRate,
    });
    return this.capsulesRepo.save(capsule);
  }

  async update(id: string, creatorId: string, updates: Partial<CreateCapsuleDto>): Promise<Capsule> {
    const capsule = await this.capsulesRepo.findOne({ where: { id, creatorId } });
    if (!capsule) throw new NotFoundException('Capsule not found');
    Object.assign(capsule, updates);
    return this.capsulesRepo.save(capsule);
  }

  async decrementStock(id: string): Promise<void> {
    const capsule = await this.capsulesRepo.findOne({ where: { id } });
    if (!capsule) throw new NotFoundException('Capsule not found');
    if (capsule.stock <= 0) throw new ForbiddenException('Capsule out of stock');

    await this.capsulesRepo.decrement({ id }, 'stock', 1);
    await this.capsulesRepo.increment({ id }, 'soldCount', 1);

    const updated = await this.capsulesRepo.findOne({ where: { id } });
    if (updated && updated.stock === 0) {
      await this.capsulesRepo.update(id, { status: CapsuleStatus.SOLD_OUT });
    }
  }

  async archive(id: string, creatorId: string): Promise<void> {
    const capsule = await this.capsulesRepo.findOne({ where: { id, creatorId } });
    if (!capsule) throw new NotFoundException('Capsule not found');
    await this.capsulesRepo.update(id, { status: CapsuleStatus.ARCHIVED });
  }
}
