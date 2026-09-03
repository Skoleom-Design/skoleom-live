import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Order } from '../orders/order.entity';
import { Boost } from '../boosts/boost.entity';
import { User } from '../users/user.entity';
import { Post } from '../posts/post.entity';
import { Gift } from '../lives/gift.entity';
import { LiveSession } from '../lives/live-session.entity';
import { WalletTransaction } from '../payments/wallet-transaction.entity';
import { Message } from '../messages/message.entity';
import { BoostsService } from '../boosts/boosts.service';
import { UsersService } from '../users/users.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { LoginLog } from '../auth/login-log.entity';
import { AdminActionLog, AdminActionType } from './admin-action-log.entity';
import { OrderStatus, BoostStatus, PostStatus, UserPlan, UserRole, BoostScope, BoostObjective, WalletTransactionType } from '../../../shared/types/entities';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(Boost)
    private boostsRepo: Repository<Boost>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Post)
    private postsRepo: Repository<Post>,
    @InjectRepository(Gift)
    private giftsRepo: Repository<Gift>,
    @InjectRepository(LiveSession)
    private livesRepo: Repository<LiveSession>,
    @InjectRepository(AdminActionLog)
    private logsRepo: Repository<AdminActionLog>,
    @InjectRepository(WalletTransaction)
    private walletTxRepo: Repository<WalletTransaction>,
    @InjectRepository(Message)
    private messagesRepo: Repository<Message>,
    @InjectRepository(LoginLog)
    private loginLogsRepo: Repository<LoginLog>,
    private boostsService: BoostsService,
    private usersService: UsersService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async getDashboardStats(period: 'day' | 'month' | 'quarter' | 'year' = 'month') {
    const now = new Date();
    let start: Date;
    switch (period) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'quarter':
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const [
      totalUsers,
      totalPosts,
      periodOrders,
      periodBoosts,
      periodGifts,
      pendingBoosts,
    ] = await Promise.all([
      this.usersRepo.count(),
      this.postsRepo.count({ where: { status: PostStatus.ACTIVE } }),
      this.ordersRepo.find({
        where: {
          status: OrderStatus.PAID,
          createdAt: Between(start, now),
        },
      }),
      this.boostsRepo.find({
        where: { createdAt: Between(start, now) },
      }),
      this.giftsRepo.find({
        where: { createdAt: Between(start, now) },
      }),
      this.boostsRepo.count({ where: { status: BoostStatus.PENDING } }),
    ]);

    // GMV (Gross Merchandise Value) = valeur totale des ventes de capsules avant commission —
    // à ne pas confondre avec "Revenus totaux", qui est ce que la plateforme encaisse réellement
    // (commissions + boosts + part plateforme des cadeaux), pas le montant brut des ventes.
    const periodGMV = periodOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    const periodCommissions = periodOrders.reduce((sum, o) => sum + Number(o.commissionAmount), 0);
    const periodBoostRevenue = periodBoosts.reduce((sum, b) => sum + Number(b.budget), 0);
    const periodGiftRevenue = periodGifts.reduce((sum, g) => sum + Number(g.platformAmount), 0);
    const totalRevenue = periodCommissions + periodBoostRevenue + periodGiftRevenue;

    return {
      totalUsers,
      totalPosts,
      periodGMV: periodGMV.toFixed(2),
      periodCommissions: periodCommissions.toFixed(2),
      periodBoostRevenue: periodBoostRevenue.toFixed(2),
      periodGiftRevenue: periodGiftRevenue.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      pendingBoosts,
      ordersCount: periodOrders.length,
    };
  }

  async getCommissions(page = 1, limit = 20, search?: string) {
    const qb = this.ordersRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.buyer', 'buyer')
      .leftJoinAndSelect('order.capsule', 'capsule')
      .leftJoinAndSelect('order.creator', 'creator')
      .where('order.status = :status', { status: OrderStatus.PAID })
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search?.trim()) {
      qb.andWhere(
        '(order.id LIKE :search OR buyer.username LIKE :search OR creator.username LIKE :search ' +
          'OR capsule.name LIKE :search OR order.createdAt LIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    const [orders, total] = await qb.getManyAndCount();
    return { orders, total, page, limit };
  }

  async getBoosts(page = 1, limit = 20, status?: BoostStatus) {
    const where = status ? { status } : {};
    const [boosts, total] = await this.boostsRepo.findAndCount({
      where,
      relations: ['user', 'post'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { boosts, total, page, limit };
  }

  async getUsers(
    page = 1,
    limit = 20,
    search?: string,
    sortBy: 'createdAt' | 'walletBalance' | 'totalEarnings' | 'username' = 'createdAt',
    sortDir: 'ASC' | 'DESC' = 'DESC',
    role?: UserRole,
    isActive?: boolean,
    plan?: UserPlan,
    isOnline?: boolean,
    trashed = false,
  ) {
    const SORTABLE = ['createdAt', 'walletBalance', 'totalEarnings', 'username'];
    const orderColumn = SORTABLE.includes(sortBy) ? sortBy : 'createdAt';
    const orderDir = sortDir === 'ASC' ? 'ASC' : 'DESC';

    // La présence vit en mémoire (RealtimeGateway), pas en base — un filtre "en ligne" doit donc
    // se résoudre en une liste d'ids AVANT la pagination SQL, sinon skip/take ne porterait que
    // sur la page courante au lieu de l'ensemble des utilisateurs.
    let onlineIds: string[] | null = null;
    if (isOnline !== undefined) {
      onlineIds = this.realtimeGateway.getOnlineUserIds();
      if (isOnline && onlineIds.length === 0) {
        return { users: [], total: 0, page, limit };
      }
    }

    const qb = this.usersRepo
      .createQueryBuilder('user')
      .select([
        'user.id', 'user.username', 'user.displayName', 'user.email', 'user.role',
        'user.isActive', 'user.plan', 'user.walletBalance', 'user.totalEarnings', 'user.createdAt',
      ])
      .orderBy(`user.${orderColumn}`, orderDir)
      .skip((page - 1) * limit)
      .take(limit);

    if (search?.trim()) {
      qb.andWhere('(user.username LIKE :search OR user.email LIKE :search OR user.displayName LIKE :search)', {
        search: `%${search.trim()}%`,
      });
    }
    // La corbeille reste un espace separe — un compte supprime n'apparait que sous l'onglet
    // dedie, jamais melange avec la liste normale (meme principe que getPosts/PostStatus.DELETED).
    if (trashed) qb.andWhere('user.deletedAt IS NOT NULL');
    else qb.andWhere('user.deletedAt IS NULL');
    if (role) qb.andWhere('user.role = :role', { role });
    if (isActive !== undefined) qb.andWhere('user.isActive = :isActive', { isActive });
    if (plan) qb.andWhere('user.plan = :plan', { plan });
    if (onlineIds !== null) {
      if (isOnline) qb.andWhere('user.id IN (:...onlineIds)', { onlineIds });
      else qb.andWhere('user.id NOT IN (:...onlineIds)', { onlineIds: onlineIds.length ? onlineIds : ['00000000-0000-0000-0000-000000000000'] });
    }

    const [users, total] = await qb.getManyAndCount();
    // "En ligne" = au moins un socket /rt actuellement identifie (voir RealtimeGateway) — sans
    // rapport avec isActive (qui veut dire "compte non suspendu"), voir le commentaire sur
    // RealtimeGateway.isUserOnline.
    const usersWithPresence = users.map((u) => ({ ...u, isOnline: this.realtimeGateway.isUserOnline(u.id) }));
    return { users: usersWithPresence, total, page, limit };
  }

  async getPosts(page = 1, limit = 20, status?: string, search?: string) {
    const qb = this.postsRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.creator', 'creator')
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // 'hidden' est un statut virtuel côté admin — modéré et archivé ont le même effet réel
    // (le post disparaît du feed), donc l'UI les traite comme un seul état "Caché".
    if (status === 'hidden') {
      qb.andWhere('post.status IN (:...statuses)', { statuses: [PostStatus.MODERATED, PostStatus.ARCHIVED] });
    } else if (status === 'trash') {
      qb.andWhere('post.status = :status', { status: PostStatus.DELETED });
    } else if (status) {
      qb.andWhere('post.status = :status', { status });
    } else {
      // Par défaut ("Tous"), la corbeille reste un espace séparé — un post supprimé n'apparaît
      // que dans l'onglet dédié, pas mélangé avec les posts actifs/cachés.
      qb.andWhere('post.status != :deleted', { deleted: PostStatus.DELETED });
    }
    if (search?.trim()) {
      qb.andWhere('(post.caption LIKE :search OR creator.username LIKE :search)', {
        search: `%${search.trim()}%`,
      });
    }

    const [posts, total] = await qb.getManyAndCount();
    return { posts, total, page, limit };
  }

  // Un même capsule peut être vendue depuis le feed ou pendant un Live — comme les commandes
  // ne stockent pas le canal d'origine, on déduit "vente Live" quand la commande tombe dans la
  // fenêtre temporelle d'un live auquel la capsule était attachée ; sinon on la compte en "feed".
  async getTopCreatorsByChannel(limit = 10) {
    const [lives, orders] = await Promise.all([
      this.livesRepo.find({ relations: ['capsules'] }),
      this.ordersRepo.find({ where: { status: OrderStatus.PAID } }),
    ]);

    const windowsByCapsule = new Map<string, { start: Date; end: Date }[]>();
    for (const live of lives) {
      if (!live.startedAt) continue;
      const end = live.endedAt ?? new Date();
      for (const capsule of live.capsules) {
        const list = windowsByCapsule.get(capsule.id) ?? [];
        list.push({ start: live.startedAt, end });
        windowsByCapsule.set(capsule.id, list);
      }
    }

    const feedByCreator = new Map<string, number>();
    const liveByCreator = new Map<string, number>();

    for (const order of orders) {
      const windows = windowsByCapsule.get(order.capsuleId) ?? [];
      const isLiveSale = windows.some((w) => order.createdAt >= w.start && order.createdAt <= w.end);
      const map = isLiveSale ? liveByCreator : feedByCreator;
      map.set(order.creatorId, (map.get(order.creatorId) ?? 0) + Number(order.creatorAmount));
    }

    const buildRanked = async (map: Map<string, number>) => {
      const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
      if (!sorted.length) return [];
      const users = await this.usersRepo.find({
        where: { id: In(sorted.map(([id]) => id)) },
        select: ['id', 'username', 'displayName', 'avatarUrl'],
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      return sorted
        .filter(([id]) => byId.has(id))
        .map(([id, revenue]) => ({ ...byId.get(id), revenue }));
    };

    const [feed, live] = await Promise.all([buildRanked(feedByCreator), buildRanked(liveByCreator)]);
    return { feed, live };
  }

  async getTopDonors(limit = 10) {
    return this.giftsRepo
      .createQueryBuilder('gift')
      .leftJoin('gift.sender', 'sender')
      .select('sender.id', 'id')
      .addSelect('sender.username', 'username')
      .addSelect('sender.displayName', 'displayName')
      .addSelect('sender.avatarUrl', 'avatarUrl')
      .addSelect('SUM(gift.amount)', 'totalSent')
      .addSelect('COUNT(gift.id)', 'giftCount')
      .groupBy('sender.id')
      .addGroupBy('sender.username')
      .addGroupBy('sender.displayName')
      .addGroupBy('sender.avatarUrl')
      .orderBy('"totalSent"', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async getTopLivers(limit = 10) {
    return this.livesRepo
      .createQueryBuilder('live')
      .leftJoin('live.creator', 'creator')
      .select('creator.id', 'id')
      .addSelect('creator.username', 'username')
      .addSelect('creator.displayName', 'displayName')
      .addSelect('creator.avatarUrl', 'avatarUrl')
      .addSelect('COUNT(live.id)', 'liveCount')
      .groupBy('creator.id')
      .addGroupBy('creator.username')
      .addGroupBy('creator.displayName')
      .addGroupBy('creator.avatarUrl')
      .orderBy('"liveCount"', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async getTopPosters(limit = 10) {
    return this.postsRepo
      .createQueryBuilder('post')
      .leftJoin('post.creator', 'creator')
      // Un post supprimé par son auteur passe en ARCHIVED (soft-delete, voir PostsService.delete)
      // plutôt que d'être retiré de la base — sans ce filtre, il continuait à compter dans le
      // classement alors qu'il n'existe plus pour personne.
      .where('post.status = :status', { status: PostStatus.ACTIVE })
      .select('creator.id', 'id')
      .addSelect('creator.username', 'username')
      .addSelect('creator.displayName', 'displayName')
      .addSelect('creator.avatarUrl', 'avatarUrl')
      .addSelect('COUNT(post.id)', 'postCount')
      .groupBy('creator.id')
      .addGroupBy('creator.username')
      .addGroupBy('creator.displayName')
      .addGroupBy('creator.avatarUrl')
      .orderBy('"postCount"', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async moderatePost(postId: string, status: PostStatus): Promise<void> {
    await this.postsRepo.update(postId, { status });
  }

  // Corbeille — soft-delete admin, distinct de ARCHIVED (soft-delete par l'auteur). Restaurable
  // via restorePost tant qu'il n'a pas été vidé via permanentlyDeletePost.
  async deletePost(postId: string): Promise<void> {
    await this.postsRepo.update(postId, { status: PostStatus.DELETED });
  }

  async restorePost(postId: string): Promise<void> {
    await this.postsRepo.update(postId, { status: PostStatus.ACTIVE });
  }

  // Vide la corbeille pour ce post — irréversible. Meme ordre de nettoyage (tables filles avant
  // le post lui-meme) que UsersService.deleteAccount ; post_likes/post_capsules sont des tables
  // de jointure avec ON DELETE CASCADE, pas besoin de les nettoyer explicitement.
  async permanentlyDeletePost(postId: string): Promise<void> {
    await this.postsRepo.manager.transaction(async (manager) => {
      await manager.query('DELETE FROM comments WHERE "postId" = $1', [postId]);
      await manager.query('DELETE FROM boosts WHERE "postId" = $1', [postId]);
      await manager.query('DELETE FROM notifications WHERE "postId" = $1', [postId]);
      await manager.query('DELETE FROM posts WHERE id = $1', [postId]);
    });
  }

  async setUserActive(userId: string, isActive: boolean, adminId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    await this.usersRepo.update(userId, { isActive });
    await this.logsRepo.save(this.logsRepo.create({
      action: AdminActionType.STATUS_CHANGE,
      adminId,
      targetUserId: userId,
      details: { from: user?.isActive, to: isActive },
    }));
  }

  // Corbeille — soft-delete admin, distinct de isActive (suspension). Restaurable via
  // restoreUser tant qu'il n'a pas ete vide via permanentlyDeleteUser (meme principe que
  // deletePost/restorePost/permanentlyDeletePost ci-dessus).
  async trashUser(userId: string, adminId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Impossible de supprimer un compte administrateur.');
    }

    await this.usersRepo.update(userId, { deletedAt: new Date(), isActive: false });
    await this.logsRepo.save(this.logsRepo.create({
      action: AdminActionType.ACCOUNT_TRASH,
      adminId,
      targetUserId: userId,
      details: { username: user.username, email: user.email },
    }));
  }

  async restoreUser(userId: string, adminId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    await this.usersRepo.update(userId, { deletedAt: null, isActive: true });
    await this.logsRepo.save(this.logsRepo.create({
      action: AdminActionType.ACCOUNT_RESTORE,
      adminId,
      targetUserId: userId,
      details: { username: user.username, email: user.email },
    }));
  }

  // Vide la corbeille pour ce compte — irreversible. Reutilise UsersService.deleteAccount, le
  // meme chemin que "supprimer mon compte" cote utilisateur, qui nettoie deja toutes les tables
  // filles dans le bon ordre. Le log est ecrit avant la suppression : targetUserId n'a pas de
  // contrainte de cle etrangere, donc la trace d'audit survit volontairement a la suppression.
  async permanentlyDeleteUser(userId: string, adminId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Impossible de supprimer un compte administrateur.');
    }

    await this.logsRepo.save(this.logsRepo.create({
      action: AdminActionType.ACCOUNT_DELETE,
      adminId,
      targetUserId: userId,
      details: { username: user.username, email: user.email },
    }));
    await this.usersService.deleteAccount(userId);
  }

  async setUserPlan(userId: string, plan: UserPlan, adminId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    await this.usersRepo.update(userId, { plan });
    await this.logsRepo.save(this.logsRepo.create({
      action: AdminActionType.PLAN_CHANGE,
      adminId,
      targetUserId: userId,
      details: { from: user?.plan, to: plan },
    }));
  }

  async creditWallet(userId: string, amount: number, adminId: string): Promise<{ walletBalance: number }> {
    if (!amount || amount <= 0) throw new BadRequestException('Montant invalide');

    await this.usersRepo.increment({ id: userId }, 'walletBalance', amount);
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    await this.logsRepo.save(this.logsRepo.create({
      action: AdminActionType.CREDIT,
      adminId,
      targetUserId: userId,
      details: { amount },
    }));
    await this.walletTxRepo.save(this.walletTxRepo.create({
      userId,
      type: WalletTransactionType.ADMIN_CREDIT,
      amount,
      description: 'Crédit ajouté par un administrateur',
    }));
    return { walletBalance: user!.walletBalance };
  }

  async grantBoost(userId: string, durationDays: number, objective: BoostObjective, adminId: string): Promise<Boost> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('Utilisateur introuvable');

    // Boost offert par un admin : créé puis activé immédiatement, sans passer par Stripe —
    // contrairement à un boost payé par le créateur lui-même (voir BoostsService.create/activate).
    // grantedByAdminId marque ce boost comme gratuit, pour que l'affichage (liste admin, détail
    // utilisateur) ne le confonde jamais avec un achat réel du créateur.
    const boost = await this.boostsService.create(userId, {
      scope: BoostScope.ACCOUNT,
      objective,
      durationDays,
    }, adminId);
    await this.boostsService.activate(boost.id);

    await this.logsRepo.save(this.logsRepo.create({
      action: AdminActionType.BOOST_GRANT,
      adminId,
      targetUserId: userId,
      details: { durationDays, objective, budget: boost.budget },
    }));

    return boost;
  }

  async cancelBoost(boostId: string, adminId: string): Promise<void> {
    const boost = await this.boostsRepo.findOne({ where: { id: boostId } });
    if (!boost) throw new BadRequestException('Boost introuvable');

    await this.boostsService.cancel(boostId);

    await this.logsRepo.save(this.logsRepo.create({
      action: AdminActionType.BOOST_CANCEL,
      adminId,
      targetUserId: boost.userId,
      details: { objective: boost.objective, durationDays: boost.durationDays, budget: boost.budget },
    }));
  }

  // Un boost payé par un créateur reste PENDING tant que le webhook Stripe de confirmation
  // n'a pas été reçu — en dev/démo sans vrai paiement, il n'arrive jamais. Cette action permet
  // à l'admin de valider manuellement (ex: paiement confirmé par un autre moyen) sans attendre.
  async approveBoost(boostId: string, adminId: string): Promise<void> {
    const boost = await this.boostsRepo.findOne({ where: { id: boostId } });
    if (!boost) throw new BadRequestException('Boost introuvable');
    // Activable depuis "en attente" (validation normale) ou "annulé" (l'admin revient sur un
    // retrait précédent) — seuls "actif" et "terminé" n'ont pas de raison d'être réactivés ici.
    if (boost.status === BoostStatus.ACTIVE || boost.status === BoostStatus.COMPLETED) {
      throw new BadRequestException('Ce boost est déjà actif ou terminé.');
    }

    await this.boostsService.activate(boostId);

    await this.logsRepo.save(this.logsRepo.create({
      action: AdminActionType.BOOST_APPROVE,
      adminId,
      targetUserId: boost.userId,
      details: { objective: boost.objective, durationDays: boost.durationDays, budget: boost.budget },
    }));
  }

  async getUserDetail(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('Utilisateur introuvable');

    const [boosts, logs, giftsSent, messagesSentRaw, loginLogs, loginCount] = await Promise.all([
      this.boostsRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.logsRepo.find({
        where: { targetUserId: userId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.giftsRepo.find({
        where: { senderId: userId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      // Modération : les messages ENVOYÉS par ce compte, avec le destinataire de chaque
      // conversation (userA/userB de Conversation sont eager, pas besoin de les recharger).
      this.messagesRepo.find({
        where: { senderId: userId },
        relations: ['conversation'],
        order: { createdAt: 'DESC' },
        take: 100,
      }),
      this.loginLogsRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.loginLogsRepo.count({ where: { userId } }),
    ]);

    const messagesSent = messagesSentRaw.map((m) => {
      const recipient = m.conversation.userAId === userId ? m.conversation.userB : m.conversation.userA;
      return {
        id: m.id,
        text: m.text,
        createdAt: m.createdAt,
        recipient: { id: recipient.id, username: recipient.username, displayName: recipient.displayName },
      };
    });

    return { user, boosts, logs, giftsSent, messagesSent, loginLogs, loginCount };
  }
}
