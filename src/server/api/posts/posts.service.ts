import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Post } from './post.entity';
import { Comment } from './comment.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowsService } from '../follows/follows.service';
import { PostStatus, PostType, NotificationType } from '../../../shared/types/entities';

export interface CreatePostDto {
  caption?: string;
  type: PostType;
  mediaUrl: string;
  thumbnailUrl?: string;
  tags?: string[];
  musicName?: string;
  musicUrl?: string;
}

export interface FeedQuery {
  page?: number;
  limit?: number;
  userId?: string;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postsRepo: Repository<Post>,
    @InjectRepository(Comment)
    private commentsRepo: Repository<Comment>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private notificationsService: NotificationsService,
    private followsService: FollowsService,
  ) {}

  async getFeed(query: FeedQuery): Promise<{ posts: Post[]; total: number }> {
    const { page = 1, limit = 20, userId } = query;

    const interests = userId
      ? (await this.usersRepo.findOne({ where: { id: userId } }))?.interests?.filter(Boolean) || []
      : [];

    // Requete en deux temps (ids d'abord, entites completes ensuite) plutot qu'un seul
    // qb.leftJoinAndSelect('post.capsules', ...) + skip/take + orderBy sur une colonne calculee
    // (interestMatch) : TypeORM genere alors une sous-requete DISTINCT pour paginer correctement
    // les jointures one-to-many, et ne sait pas y reporter un addSelect() brut — SQL invalide
    // ("column interestMatch does not exist" / erreur de syntaxe), 500 silencieux cote client.
    const idQb = this.postsRepo
      .createQueryBuilder('post')
      .select('post.id', 'id')
      .where('post.status = :status', { status: PostStatus.ACTIVE });

    if (interests.length) {
      // Fait remonter les posts dont au moins un tag correspond à un centre d'intérêt choisi
      // à l'onboarding, sans jamais exclure le reste — le feed reste alimenté même hors match.
      idQb.addSelect(
        "CASE WHEN post.tags::jsonb ?| array[:...interests] THEN 1 ELSE 0 END",
        'interestMatch',
      )
        .setParameter('interests', interests)
        .orderBy('"interestMatch"', 'DESC')
        .addOrderBy('post.boostScore', 'DESC')
        .addOrderBy('post.createdAt', 'DESC');
    } else {
      idQb.orderBy('post.boostScore', 'DESC').addOrderBy('post.createdAt', 'DESC');
    }

    const total = await idQb.getCount();
    const rows = await idQb.skip((page - 1) * limit).take(limit).getRawMany();
    const ids: string[] = rows.map((r) => r.id);
    if (!ids.length) return { posts: [], total };

    const posts = await this.postsRepo.find({
      where: { id: In(ids) },
      relations: ['creator', 'capsules'],
    });
    // .find() avec In() ne garantit pas l'ordre — on reapplique l'ordre calcule ci-dessus.
    const byId = new Map(posts.map((p) => [p.id, p]));
    return { posts: ids.map((id) => byId.get(id)).filter((p): p is Post => !!p), total };
  }

  async getById(id: string, viewerId?: string): Promise<Post> {
    const post = await this.postsRepo.findOne({
      where: { id },
      relations: ['creator', 'capsules', 'boosts'],
    });
    if (!post) throw new NotFoundException('Post not found');

    // Ne compte que les vues des AUTRES utilisateurs — un créateur qui consulte son propre post
    // (ex: depuis son profil) ne doit pas gonfler ses propres statistiques.
    if (viewerId !== post.creatorId) {
      await this.postsRepo.increment({ id }, 'viewCount', 1);
      post.viewCount += 1;
    }
    return post;
  }

  async create(creatorId: string, dto: CreatePostDto): Promise<Post> {
    const post = this.postsRepo.create({ ...dto, creatorId });
    const saved = await this.postsRepo.save(post);

    // Fan-out vers les abonnes — jamais bloquant pour la publication elle-meme si ca echoue.
    this.followsService.getFollowerIds(creatorId)
      .then((followerIds) => this.notificationsService.notifyMany(followerIds, creatorId, NotificationType.NEW_POST, { postId: saved.id }))
      .catch(() => {});

    return saved;
  }

  async delete(id: string, requesterId: string, isAdmin = false): Promise<void> {
    const post = await this.postsRepo.findOne({
      where: isAdmin ? { id } : { id, creatorId: requesterId },
    });
    if (!post) throw new NotFoundException('Post not found');
    await this.postsRepo.update(id, { status: PostStatus.ARCHIVED });
  }

  async update(
    id: string,
    creatorId: string,
    updates: { caption?: string; tags?: string[]; mediaUrl?: string; thumbnailUrl?: string; type?: PostType },
  ): Promise<Post> {
    const post = await this.postsRepo.findOne({ where: { id, creatorId } });
    if (!post) throw new NotFoundException('Post not found');
    await this.postsRepo.update(id, updates);
    return this.postsRepo.findOne({ where: { id } }) as Promise<Post>;
  }

  async incrementBoostScore(postId: string, score: number): Promise<void> {
    await this.postsRepo.increment({ id: postId }, 'boostScore', score);
    await this.postsRepo.update(postId, { isBoosted: true });
  }

  async boostAllByCreator(creatorId: string, score: number): Promise<void> {
    await this.postsRepo.increment({ creatorId, status: PostStatus.ACTIVE }, 'boostScore', score);
    await this.postsRepo.update({ creatorId, status: PostStatus.ACTIVE }, { isBoosted: true });
  }

  async decrementBoostScore(postId: string, score: number): Promise<void> {
    await this.postsRepo.decrement({ id: postId }, 'boostScore', score);
  }

  async unboostAllByCreator(creatorId: string, score: number): Promise<void> {
    await this.postsRepo.decrement({ creatorId, status: PostStatus.ACTIVE }, 'boostScore', score);
  }

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const post = await this.postsRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    // Passer par l'API de relation plutôt que par push()+save() sur le tableau likedBy —
    // cette dernière ne persistait pas la ligne dans la table pivot post_likes (le like
    // "marchait" côté compteur mais ne s'enregistrait jamais réellement pour l'utilisateur).
    const likers = await this.postsRepo
      .createQueryBuilder()
      .relation(Post, 'likedBy')
      .of(postId)
      .loadMany<User>();
    const alreadyLiked = likers.some((u) => u.id === userId);

    const relation = this.postsRepo.createQueryBuilder().relation(Post, 'likedBy').of(postId);
    if (alreadyLiked) {
      await relation.remove(userId);
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      await relation.add(userId);
      post.likeCount += 1;
      await this.notificationsService.notify(post.creatorId, userId, NotificationType.LIKE, { postId });
    }
    await this.postsRepo.update(postId, { likeCount: post.likeCount });
    return { liked: !alreadyLiked, likeCount: post.likeCount };
  }

  async addComment(postId: string, userId: string, text: string): Promise<Comment> {
    const trimmed = text?.trim();
    if (!trimmed) throw new BadRequestException('Commentaire vide');

    const post = await this.postsRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const saved = await this.commentsRepo.save(
      this.commentsRepo.create({ postId, userId, text: trimmed.slice(0, 1000) }),
    );
    await this.postsRepo.increment({ id: postId }, 'commentCount', 1);
    await this.notificationsService.notify(post.creatorId, userId, NotificationType.COMMENT, { postId });

    // save() ne recharge pas la relation eager "user" sur l'entité retournée — seul un
    // find/findOne le fait — donc on la recharge explicitement pour renvoyer un objet complet.
    return (await this.commentsRepo.findOne({ where: { id: saved.id } }))!;
  }

  async incrementShare(postId: string): Promise<void> {
    await this.postsRepo.increment({ id: postId }, 'shareCount', 1);
  }

  async getComments(postId: string): Promise<Comment[]> {
    return this.commentsRepo.find({
      where: { postId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  // Le commentaire lui-meme n'a pas de creatorId de post en cache — on va chercher le post pour
  // savoir si le demandeur en est le proprietaire (seul cas ou il peut supprimer le commentaire
  // de quelqu'un d'autre), en plus de son propre commentaire.
  async deleteComment(commentId: string, requesterId: string, isAdmin = false): Promise<void> {
    const comment = await this.commentsRepo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Commentaire introuvable');

    if (!isAdmin && comment.userId !== requesterId) {
      const post = await this.postsRepo.findOne({ where: { id: comment.postId } });
      if (!post || post.creatorId !== requesterId) {
        throw new ForbiddenException('Tu ne peux pas supprimer ce commentaire.');
      }
    }

    await this.commentsRepo.delete(commentId);
    await this.postsRepo.decrement({ id: comment.postId }, 'commentCount', 1);
  }

  async getLikedByUser(userId: string): Promise<Post[]> {
    return this.postsRepo
      .createQueryBuilder('post')
      .innerJoin('post.likedBy', 'liker', 'liker.id = :userId', { userId })
      .leftJoinAndSelect('post.creator', 'creator')
      .leftJoinAndSelect('post.capsules', 'capsules')
      .where('post.status = :status', { status: PostStatus.ACTIVE })
      .orderBy('post.createdAt', 'DESC')
      .getMany();
  }

  async getByCreator(creatorId: string): Promise<Post[]> {
    return this.postsRepo.find({
      where: { creatorId, status: PostStatus.ACTIVE },
      relations: ['capsules'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAnalytics(creatorId: string): Promise<{
    posts: (Post & { totalSold: number; revenue: number; engagementRate: number })[];
    totals: { views: number; likes: number; sold: number; revenue: number };
  }> {
    const posts = await this.postsRepo.find({
      where: { creatorId, status: PostStatus.ACTIVE },
      relations: ['capsules'],
      order: { viewCount: 'DESC' },
    });

    let totalViews = 0, totalLikes = 0, totalSold = 0, totalRevenue = 0;
    const countedCapsules = new Set<string>();

    const enriched = posts.map((post) => {
      const sold = post.capsules.reduce((s, c) => s + c.soldCount, 0);
      const revenue = post.capsules.reduce((s, c) => s + c.price * c.soldCount * (1 - c.commissionRate / 100), 0);
      const engagementRate = post.viewCount > 0 ? (post.likeCount / post.viewCount) * 100 : 0;

      totalViews += post.viewCount;
      totalLikes += post.likeCount;

      // Une capsule peut être rattachée à plusieurs posts — ne compter ses ventes qu'une fois dans les totaux.
      post.capsules.forEach((c) => {
        if (countedCapsules.has(c.id)) return;
        countedCapsules.add(c.id);
        totalSold += c.soldCount;
        totalRevenue += c.price * c.soldCount * (1 - c.commissionRate / 100);
      });

      return { ...post, totalSold: sold, revenue, engagementRate };
    });

    return {
      posts: enriched,
      totals: { views: totalViews, likes: totalLikes, sold: totalSold, revenue: totalRevenue },
    };
  }
}
