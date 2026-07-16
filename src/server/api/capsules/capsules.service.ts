import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Capsule } from './capsule.entity';
import { Post } from '../posts/post.entity';
import { CapsuleStatus, CapsuleCondition, CapsuleCategory } from '../../../shared/types/entities';

export interface CreateCapsuleDto {
  postId?: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  images?: string[];
  condition?: CapsuleCondition;
  category?: CapsuleCategory;
  subcategory?: string;
  size?: string;
  colors?: string[];
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
    return this.capsulesRepo
      .createQueryBuilder('capsule')
      .innerJoin('capsule.posts', 'post', 'post.id = :postId', { postId })
      .where('capsule.status = :status', { status: CapsuleStatus.AVAILABLE })
      .getMany();
  }

  async getMine(creatorId: string): Promise<Capsule[]> {
    return this.capsulesRepo.find({
      where: { creatorId, status: CapsuleStatus.AVAILABLE },
      order: { createdAt: 'DESC' },
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
    if (dto.price < 1) throw new BadRequestException('Le prix minimum est de 1€.');

    const { postId, ...rest } = dto;
    const commissionRate = parseFloat(process.env.COMMISSION_RATE || '0.15') * 100;
    const capsule = this.capsulesRepo.create({
      ...rest,
      images: dto.images || [],
      creatorId,
      commissionRate,
      posts: postId ? [{ id: postId } as Post] : [],
    });
    return this.capsulesRepo.save(capsule);
  }

  async attachToPost(capsuleId: string, postId: string, creatorId: string): Promise<Capsule> {
    const capsule = await this.capsulesRepo.findOne({
      where: { id: capsuleId, creatorId },
      relations: ['posts'],
    });
    if (!capsule) throw new NotFoundException('Capsule not found');
    if (!capsule.posts.some((p) => p.id === postId)) {
      capsule.posts.push({ id: postId } as Post);
      await this.capsulesRepo.save(capsule);
    }
    return capsule;
  }

  async update(id: string, creatorId: string, updates: Partial<CreateCapsuleDto>): Promise<Capsule> {
    if (updates.price !== undefined && updates.price < 1) {
      throw new BadRequestException('Le prix minimum est de 1€.');
    }

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
