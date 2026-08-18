import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Capsule } from './capsule.entity';
import { CapsuleGroup } from './capsule-group.entity';
import { Post } from '../posts/post.entity';
import { User } from '../users/user.entity';
import { CapsuleStatus, CapsuleCondition, CapsuleCategory, UserPlan } from '../../../shared/types/entities';

export interface CreateCapsuleDto {
  postId?: string;
  name: string;
  brand?: string;
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

export interface CreateCapsuleGroupDto {
  name: string;
  postId?: string;
  products: Omit<CreateCapsuleDto, 'postId'>[];
}

// Nombre de capsules (au total) et de produits par capsule autorisés selon l'offre —
// reprend les valeurs affichées dans la section abonnement du profil.
const CAPSULE_GROUP_COUNT_LIMITS: Record<UserPlan, number | null> = {
  [UserPlan.FREE]: 2,
  [UserPlan.PREMIUM]: 15,
  [UserPlan.ULTRA]: null,
};

const CAPSULE_GROUP_PRODUCT_LIMITS: Record<UserPlan, number | null> = {
  [UserPlan.FREE]: 2,
  [UserPlan.PREMIUM]: 5,
  [UserPlan.ULTRA]: 8,
};

// Commission prelevee sur chaque vente, selon l'offre du createur au moment ou il cree la
// capsule — plus l'offre est elevee, moins la plateforme prend de commission. Fige sur la
// capsule a la creation (voir Capsule.commissionRate) : un changement d'offre plus tard ne
// modifie pas retroactivement les capsules deja en ligne, seulement les nouvelles.
const COMMISSION_RATE_BY_PLAN: Record<UserPlan, number> = {
  [UserPlan.FREE]: 15,
  [UserPlan.PREMIUM]: 10,
  [UserPlan.ULTRA]: 5,
};

@Injectable()
export class CapsulesService {
  constructor(
    @InjectRepository(Capsule)
    private capsulesRepo: Repository<Capsule>,
    @InjectRepository(CapsuleGroup)
    private capsuleGroupsRepo: Repository<CapsuleGroup>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
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
      relations: ['group'],
      order: { createdAt: 'DESC' },
    });
  }

  async getById(id: string): Promise<Capsule> {
    const capsule = await this.capsulesRepo.findOne({
      where: { id },
      relations: ['posts', 'group'],
    });
    if (!capsule) throw new NotFoundException('Capsule not found');
    return capsule;
  }

  async create(creatorId: string, dto: CreateCapsuleDto): Promise<Capsule> {
    if (dto.price < 1) throw new BadRequestException('Le prix minimum est de 1€.');

    const creator = await this.usersRepo.findOne({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('User not found');

    const { postId, ...rest } = dto;
    const commissionRate = COMMISSION_RATE_BY_PLAN[creator.plan];
    const capsule = this.capsulesRepo.create({
      ...rest,
      images: dto.images || [],
      creatorId,
      commissionRate,
      posts: postId ? [{ id: postId } as Post] : [],
    });
    return this.capsulesRepo.save(capsule);
  }

  async createGroup(creatorId: string, dto: CreateCapsuleGroupDto): Promise<CapsuleGroup> {
    if (!dto.name?.trim()) throw new BadRequestException('Le nom de la capsule est requis.');
    if (!dto.products || dto.products.length === 0) {
      throw new BadRequestException('Ajoute au moins un produit à la capsule.');
    }
    if (dto.products.some((p) => p.price < 1)) {
      throw new BadRequestException('Le prix minimum est de 1€.');
    }

    const creator = await this.usersRepo.findOne({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('User not found');

    const productLimit = CAPSULE_GROUP_PRODUCT_LIMITS[creator.plan];
    if (productLimit !== null && dto.products.length > productLimit) {
      throw new BadRequestException(
        `Ton offre actuelle autorise jusqu'à ${productLimit} produit${productLimit > 1 ? 's' : ''} par capsule.`,
      );
    }

    const groupLimit = CAPSULE_GROUP_COUNT_LIMITS[creator.plan];
    if (groupLimit !== null) {
      const existingGroups = await this.capsuleGroupsRepo.count({ where: { creatorId } });
      if (existingGroups >= groupLimit) {
        throw new BadRequestException(
          `Ton offre actuelle autorise jusqu'à ${groupLimit} capsule${groupLimit > 1 ? 's' : ''}.`,
        );
      }
    }

    const commissionRate = COMMISSION_RATE_BY_PLAN[creator.plan];

    return this.capsulesRepo.manager.transaction(async (manager) => {
      const group = await manager.save(
        manager.create(CapsuleGroup, { name: dto.name.trim(), creatorId }),
      );

      const products = dto.products.map((product) =>
        manager.create(Capsule, {
          ...product,
          images: product.images || [],
          creatorId,
          commissionRate,
          groupId: group.id,
          posts: dto.postId ? [{ id: dto.postId } as Post] : [],
        }),
      );
      await manager.save(products);

      group.products = products;
      return group;
    });
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

  async detachFromPost(capsuleId: string, postId: string, creatorId: string): Promise<Capsule> {
    const capsule = await this.capsulesRepo.findOne({
      where: { id: capsuleId, creatorId },
      relations: ['posts'],
    });
    if (!capsule) throw new NotFoundException('Capsule not found');
    capsule.posts = capsule.posts.filter((p) => p.id !== postId);
    await this.capsulesRepo.save(capsule);
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
