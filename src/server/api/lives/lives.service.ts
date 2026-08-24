import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { LiveSession } from './live-session.entity';
import { LiveGuest } from './live-guest.entity';
import { LiveViewerAccess } from './live-viewer-access.entity';
import { LiveComment } from './live-comment.entity';
import { Gift } from './gift.entity';
import { AuctionBid } from './auction-bid.entity';
import { Capsule } from '../capsules/capsule.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { WalletTransaction } from '../payments/wallet-transaction.entity';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowsService } from '../follows/follows.service';
import { LiveStatus, LiveMode, OrderStatus, WalletTransactionType, UserPlan, NotificationType } from '../../../shared/types/entities';

// Nombre de manches d'enchère autorisées par live selon l'offre — même principe que les
// limites de capsules par offre (voir CAPSULE_GROUP_COUNT_LIMITS dans capsules.service.ts).
const AUCTION_ROUNDS_LIMIT: Record<UserPlan, number | null> = {
  [UserPlan.FREE]: 2,
  [UserPlan.PREMIUM]: 10,
  [UserPlan.ULTRA]: null,
};

export interface LaunchAuctionRoundDto {
  capsuleId: string;
  startingBid: number;
  durationSeconds: number;
}

export interface AuctionSettlement {
  liveId: string;
  winnerId: string | null;
  amount: number | null;
}

// Si une mise arrive dans les 30 dernières secondes, l'enchère est prolongée de 30s — évite
// le "sniping" (miser à la toute dernière seconde pour ne laisser aucune chance de surenchérir).
const ANTI_SNIPE_WINDOW_MS = 30_000;
const ANTI_SNIPE_EXTENSION_MS = 30_000;

// Plafond technique anti-abus sur le nombre d'invités simultanés d'un live (ex-duo, généralisé
// à N) — pas une limite métier par offre, juste un garde-fou (voir LivesGateway).
export const MAX_LIVE_GUESTS = 12;

// Catalogue des cadeaux virtuels — doit rester aligné avec GIFTS dans src/pages/live.tsx.
export const GIFT_CATALOG: Record<string, number> = {
  rose: 0.10,
  etoile: 0.50,
  feu: 1.50,
  coeur: 2,
  rocket: 5,
  diamant: 10,
  trophee: 15,
  couronne: 20,
};

@Injectable()
export class LivesService {
  constructor(
    @InjectRepository(LiveSession)
    private livesRepo: Repository<LiveSession>,
    @InjectRepository(LiveGuest)
    private liveGuestsRepo: Repository<LiveGuest>,
    @InjectRepository(LiveViewerAccess)
    private viewerAccessRepo: Repository<LiveViewerAccess>,
    @InjectRepository(LiveComment)
    private commentsRepo: Repository<LiveComment>,
    @InjectRepository(Gift)
    private giftsRepo: Repository<Gift>,
    @InjectRepository(Capsule)
    private capsulesRepo: Repository<Capsule>,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(WalletTransaction)
    private walletTxRepo: Repository<WalletTransaction>,
    @InjectRepository(AuctionBid)
    private bidsRepo: Repository<AuctionBid>,
    private paymentsService: PaymentsService,
    private notificationsService: NotificationsService,
    private followsService: FollowsService,
  ) {}

  // Previent les abonnes qu'un createur vient de passer en live — jamais bloquant pour le
  // demarrage du live lui-meme si le fan-out echoue.
  private notifyFollowersLiveStarted(creatorId: string, liveId: string): void {
    this.followsService.getFollowerIds(creatorId)
      .then((followerIds) => this.notificationsService.notifyMany(followerIds, creatorId, NotificationType.LIVE_STARTED, { liveId }))
      .catch(() => {});
  }

  async start(creatorId: string, title?: string, isPrivate?: boolean): Promise<LiveSession> {
    const existing = await this.livesRepo.findOne({ where: { creatorId, status: LiveStatus.LIVE } });
    if (existing) throw new BadRequestException('Un live est déjà en cours sur ce compte.');
    await this.assertNotInRestartCooldown(creatorId);

    const live = this.livesRepo.create({
      creatorId,
      title,
      status: LiveStatus.LIVE,
      mode: LiveMode.LIVE,
      startedAt: new Date(),
      isPrivate: !!isPrivate,
    });
    const saved = await this.livesRepo.save(live);
    this.notifyFollowersLiveStarted(creatorId, saved.id);
    return saved;
  }

  async startAuction(creatorId: string, title?: string, isPrivate?: boolean): Promise<LiveSession> {
    const existing = await this.livesRepo.findOne({ where: { creatorId, status: LiveStatus.LIVE } });
    if (existing) throw new BadRequestException('Un live est déjà en cours sur ce compte.');
    await this.assertNotInRestartCooldown(creatorId);

    const live = this.livesRepo.create({
      creatorId,
      title,
      status: LiveStatus.LIVE,
      mode: LiveMode.AUCTION,
      startedAt: new Date(),
      auctionActive: false,
      isPrivate: !!isPrivate,
    });
    const saved = await this.livesRepo.save(live);
    this.notifyFollowersLiveStarted(creatorId, saved.id);
    return saved;
  }

  // Delai minimum entre la fin d'un live et le suivant — evite de pouvoir relancer un live
  // immediatement (ex: navigation qui vient de le terminer automatiquement par erreur), sans
  // pour autant bloquer longtemps un vendeur qui a fait une vraie erreur.
  private readonly LIVE_RESTART_COOLDOWN_MS = 60_000;

  // Secondes restantes avant de pouvoir relancer un live — 0 si aucun cooldown en cours.
  // Utilise a la fois par le controller (endpoint affiche cote client avant meme de cliquer
  // "Démarrer") et par assertNotInRestartCooldown ci-dessous (verification serveur faisant foi).
  async getRestartCooldownSeconds(creatorId: string): Promise<number> {
    const lastEnded = await this.livesRepo.findOne({
      where: { creatorId, status: LiveStatus.ENDED },
      order: { endedAt: 'DESC' },
    });
    if (!lastEnded?.endedAt) return 0;
    const elapsed = Date.now() - new Date(lastEnded.endedAt).getTime();
    return elapsed < this.LIVE_RESTART_COOLDOWN_MS
      ? Math.ceil((this.LIVE_RESTART_COOLDOWN_MS - elapsed) / 1000)
      : 0;
  }

  private async assertNotInRestartCooldown(creatorId: string): Promise<void> {
    const remaining = await this.getRestartCooldownSeconds(creatorId);
    if (remaining > 0) {
      throw new BadRequestException(
        `Merci d'attendre encore ${remaining} seconde${remaining > 1 ? 's' : ''} avant de relancer un live.`,
      );
    }
  }

  // Lance une nouvelle manche d'enchere pour une capsule donnee, en plein direct. Peut etre
  // appele plusieurs fois de suite sur le meme live (une manche par capsule presentee).
  async launchCapsuleAuction(liveId: string, creatorId: string, dto: LaunchAuctionRoundDto): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id: liveId, creatorId } });
    if (!live) throw new NotFoundException('Live introuvable');
    if (live.mode !== LiveMode.AUCTION) throw new BadRequestException("Ce live n'est pas en mode enchère.");
    if (live.status !== LiveStatus.LIVE) throw new BadRequestException('Ce live est terminé.');
    if (live.auctionActive) throw new BadRequestException('Une enchère est déjà en cours — attends qu\'elle se termine.');

    const roundsLimit = AUCTION_ROUNDS_LIMIT[live.creator.plan];
    if (roundsLimit !== null && live.auctionRoundsCount >= roundsLimit) {
      throw new BadRequestException(
        `Ton offre actuelle te donne droit à ${roundsLimit} manches d'enchère par live — passe à un palier supérieur pour en lancer davantage.`,
      );
    }

    if (!dto.startingBid || dto.startingBid < 1) {
      throw new BadRequestException("La mise de départ doit être d'au moins 1€.");
    }
    if (!dto.durationSeconds || dto.durationSeconds < 30) {
      throw new BadRequestException("La durée de l'enchère est invalide.");
    }

    const capsule = await this.capsulesRepo.findOne({ where: { id: dto.capsuleId, creatorId } });
    if (!capsule) throw new NotFoundException('Capsule introuvable');
    if (capsule.stock <= 0) throw new BadRequestException('Cette capsule est épuisée.');

    // .update() ecrit uniquement les colonnes fournies, sans passer par les relations eager
    // (auctionCapsule/currentBidder) chargees sur `live` — sinon save() sur l'entite peut re-
    // ecrire l'ancienne relation en memoire par-dessus les colonnes qu'on vient de modifier.
    await this.livesRepo.update(liveId, {
      auctionCapsuleId: dto.capsuleId,
      startingBid: dto.startingBid,
      currentBid: dto.startingBid,
      currentBidderId: null as unknown as string,
      auctionEndsAt: new Date(Date.now() + dto.durationSeconds * 1000),
      auctionSettled: false,
      auctionActive: true,
      auctionRoundsCount: live.auctionRoundsCount + 1,
    });
    return (await this.livesRepo.findOne({ where: { id: liveId } }))!;
  }

  async placeBid(liveId: string, bidderId: string, amount: number): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id: liveId } });
    if (!live) throw new NotFoundException('Live introuvable');
    if (live.mode !== LiveMode.AUCTION) throw new BadRequestException("Ce live n'est pas une enchère.");
    if (!live.auctionActive || (live.auctionEndsAt && live.auctionEndsAt.getTime() <= Date.now())) {
      throw new BadRequestException('Aucune enchère en cours pour le moment.');
    }
    if (live.creatorId === bidderId) {
      throw new BadRequestException('Tu ne peux pas enchérir sur ta propre enchère.');
    }
    if (!amount || amount <= Number(live.currentBid)) {
      throw new BadRequestException(`Ton enchère doit dépasser ${Number(live.currentBid).toFixed(2)}€.`);
    }

    const bidder = await this.usersRepo.findOne({ where: { id: bidderId } });
    if (!bidder || Number(bidder.walletBalance) < amount) {
      throw new BadRequestException('Solde insuffisant pour cette enchère — recharge ton wallet.');
    }

    let newEndsAt = live.auctionEndsAt;
    if (newEndsAt && newEndsAt.getTime() - Date.now() < ANTI_SNIPE_WINDOW_MS) {
      newEndsAt = new Date(Date.now() + ANTI_SNIPE_EXTENSION_MS);
    }

    // .update() plutot que save(live) — meme raison que dans launchCapsuleAuction : `live`
    // porte encore la relation eager currentBidder de l'enchérisseur precedent, et save()
    // risquerait de la reecrire par-dessus le nouveau currentBidderId qu'on vient de definir.
    await this.livesRepo.update(liveId, {
      currentBid: amount,
      currentBidderId: bidderId,
      auctionEndsAt: newEndsAt,
    });
    await this.bidsRepo.save(this.bidsRepo.create({ liveSessionId: liveId, bidderId, amount }));

    return (await this.livesRepo.findOne({ where: { id: liveId } }))!;
  }

  async getBidHistory(liveId: string): Promise<AuctionBid[]> {
    return this.bidsRepo.find({
      where: { liveSessionId: liveId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  // Reglement d'une manche d'enchere : cree la commande gagnante (debit/credit wallet via le
  // meme chemin qu'un achat de capsule classique) si quelqu'un a enchéri, sinon cloture sans
  // vente. Ne termine PAS le live — une autre manche peut suivre sur une autre capsule.
  async settleAuction(liveId: string): Promise<AuctionSettlement> {
    const live = await this.livesRepo.findOne({ where: { id: liveId } });
    if (!live || !live.auctionActive || live.auctionSettled) {
      return { liveId, winnerId: null, amount: null };
    }

    live.auctionSettled = true;
    live.auctionActive = false;

    let winnerId: string | null = null;
    let amount: number | null = null;

    if (live.currentBidderId && live.auctionCapsuleId && live.currentBid) {
      try {
        await this.paymentsService.settleAuctionSale(live.currentBidderId, live.auctionCapsuleId, Number(live.currentBid));
        winnerId = live.currentBidderId;
        amount = Number(live.currentBid);
      } catch {
        // Le solde du gagnant a pu changer entre-temps (ex: dépensé ailleurs) — l'enchère se
        // clôture quand même sans vente plutôt que de rester bloquée indéfiniment.
      }
    }

    await this.livesRepo.save(live);
    return { liveId, winnerId, amount };
  }

  async settleExpiredAuctions(): Promise<AuctionSettlement[]> {
    const expired = await this.livesRepo.find({
      where: {
        mode: LiveMode.AUCTION,
        status: LiveStatus.LIVE,
        auctionActive: true,
        auctionEndsAt: LessThanOrEqual(new Date()),
      },
    });

    const results: AuctionSettlement[] = [];
    for (const live of expired) {
      results.push(await this.settleAuction(live.id));
    }
    return results;
  }

  async end(id: string, creatorId: string): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id, creatorId } });
    if (!live) throw new NotFoundException('Live introuvable');

    if (live.mode === LiveMode.AUCTION && live.auctionActive) {
      await this.settleAuction(id);
    }

    await this.livesRepo.update(id, { status: LiveStatus.ENDED, endedAt: new Date() });
    return (await this.livesRepo.findOne({ where: { id } }))!;
  }

  async getActive(): Promise<LiveSession[]> {
    return this.livesRepo.find({
      where: { status: LiveStatus.LIVE },
      order: { startedAt: 'DESC' },
    });
  }

  async getMine(creatorId: string): Promise<LiveSession | null> {
    return this.livesRepo.findOne({
      where: { creatorId, status: LiveStatus.LIVE },
      relations: ['capsules'],
    });
  }

  // Nombre total de lives déjà faits par ce créateur (tous statuts confondus) — affiché dans
  // les statistiques du profil, à côté du nombre de posts.
  async countByCreator(creatorId: string): Promise<number> {
    return this.livesRepo.count({ where: { creatorId } });
  }

  async getById(id: string): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id }, relations: ['capsules'] });
    if (!live) throw new NotFoundException('Live introuvable');
    return live;
  }

  async addCapsule(liveId: string, capsuleId: string, creatorId: string): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id: liveId, creatorId }, relations: ['capsules'] });
    if (!live) throw new NotFoundException('Live introuvable');

    const capsule = await this.capsulesRepo.findOne({ where: { id: capsuleId, creatorId } });
    if (!capsule) throw new NotFoundException('Capsule introuvable');

    if (!live.capsules.some((c) => c.id === capsuleId)) {
      live.capsules.push(capsule);
      await this.livesRepo.save(live);
    }
    return live;
  }

  async removeCapsule(liveId: string, capsuleId: string, creatorId: string): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id: liveId, creatorId }, relations: ['capsules'] });
    if (!live) throw new NotFoundException('Live introuvable');

    live.capsules = live.capsules.filter((c) => c.id !== capsuleId);
    if (live.featuredCapsuleId === capsuleId) live.featuredCapsuleId = null as unknown as string;
    await this.livesRepo.save(live);
    return live;
  }

  // Met en avant (ou retire, si capsuleId est null) le produit "en vente maintenant" d'un live
  // classique — c'est la file de vente façon Whatnot : le créateur avance manuellement de
  // produit en produit pendant le direct, et le changement est diffusé à tous les spectateurs
  // (voir LivesGateway.broadcastFeaturedCapsule, appelé par le controller juste après).
  async setFeaturedCapsule(liveId: string, creatorId: string, capsuleId: string | null): Promise<LiveSession> {
    const live = await this.livesRepo.findOne({ where: { id: liveId, creatorId }, relations: ['capsules'] });
    if (!live) throw new NotFoundException('Live introuvable');
    if (live.mode !== LiveMode.LIVE) {
      throw new BadRequestException("La mise en avant de produit n'est disponible qu'en mode live classique.");
    }
    if (capsuleId !== null && !live.capsules.some((c) => c.id === capsuleId)) {
      throw new BadRequestException("Cette capsule n'est pas attachée à ce live — ajoute-la d'abord.");
    }

    await this.livesRepo.update(liveId, { featuredCapsuleId: capsuleId as unknown as string });
    return (await this.livesRepo.findOne({ where: { id: liveId }, relations: ['capsules'] }))!;
  }

  async getSales(liveId: string): Promise<{ count: number; revenue: number }> {
    const live = await this.livesRepo.findOne({ where: { id: liveId }, relations: ['capsules'] });
    if (!live) throw new NotFoundException('Live introuvable');
    if (live.capsules.length === 0 || !live.startedAt) return { count: 0, revenue: 0 };

    const orders = await this.ordersRepo.find({
      where: {
        capsuleId: In(live.capsules.map((c) => c.id)),
        status: OrderStatus.PAID,
      },
    });

    const windowEnd = live.endedAt ?? new Date();
    const inWindow = orders.filter(
      (o) => o.createdAt >= live.startedAt && o.createdAt <= windowEnd,
    );

    return {
      count: inWindow.length,
      revenue: inWindow.reduce((sum, o) => sum + Number(o.creatorAmount), 0),
    };
  }

  async addComment(liveId: string, userId: string, text: string): Promise<LiveComment> {
    const comment = this.commentsRepo.create({ liveSessionId: liveId, userId, text });
    return this.commentsRepo.save(comment);
  }

  async getComments(liveId: string, viewerId?: string): Promise<LiveComment[]> {
    const live = await this.livesRepo.findOne({ where: { id: liveId } });
    if (live && !(await this.hasViewAccess(live, viewerId))) {
      throw new ForbiddenException('Ce live est privé.');
    }
    return this.commentsRepo.find({
      where: { liveSessionId: liveId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.commentsRepo.delete(commentId);
  }

  async isOwner(liveId: string, userId: string): Promise<boolean> {
    const live = await this.livesRepo.findOne({ where: { id: liveId } });
    return live?.creatorId === userId;
  }

  async sendGift(liveId: string, senderId: string, giftType: string): Promise<{ walletBalance: number; senderUsername: string; senderDisplayName?: string }> {
    const live = await this.livesRepo.findOne({ where: { id: liveId } });
    if (!live) throw new NotFoundException('Live introuvable');
    if (live.creatorId === senderId) throw new BadRequestException('Tu ne peux pas t\'envoyer un cadeau à toi-même');

    const amount = GIFT_CATALOG[giftType];
    if (!amount) throw new BadRequestException('Cadeau inconnu');

    const sender = await this.usersRepo.findOne({ where: { id: senderId } });
    if (!sender || Number(sender.walletBalance) < amount) {
      throw new BadRequestException('Solde insuffisant');
    }

    const creatorAmount = Math.round(amount * 0.5 * 100) / 100;
    const platformAmount = Math.round((amount - creatorAmount) * 100) / 100;

    await this.usersRepo.decrement({ id: senderId }, 'walletBalance', amount);
    await this.usersRepo.increment({ id: live.creatorId }, 'walletBalance', creatorAmount);
    await this.usersRepo.increment({ id: live.creatorId }, 'totalEarnings', creatorAmount);

    const gift = await this.giftsRepo.save(this.giftsRepo.create({
      giftType,
      senderId,
      receiverId: live.creatorId,
      liveSessionId: liveId,
      amount,
      creatorAmount,
      platformAmount,
    }));

    await this.walletTxRepo.save(this.walletTxRepo.create({
      userId: senderId,
      type: WalletTransactionType.GIFT_SENT,
      amount: -amount,
      description: `Cadeau envoyé (${giftType})`,
      reference: gift.id,
    }));
    await this.walletTxRepo.save(this.walletTxRepo.create({
      userId: live.creatorId,
      type: WalletTransactionType.GIFT_RECEIVED,
      amount: creatorAmount,
      description: `Cadeau reçu (${giftType})`,
      reference: gift.id,
    }));

    const updated = await this.usersRepo.findOne({ where: { id: senderId } });
    return {
      walletBalance: Number(updated!.walletBalance),
      senderUsername: sender.username,
      senderDisplayName: sender.displayName,
    };
  }

  // Classement des plus gros donateurs de ce live (somme des cadeaux envoyes) — affiche au-dessus
  // du chat pour inciter a la competition sociale entre spectateurs.
  async getTopDonors(liveId: string): Promise<{ userId: string; username: string; displayName?: string; avatarUrl?: string; totalAmount: number }[]> {
    const rows = await this.giftsRepo
      .createQueryBuilder('gift')
      .select('gift.senderId', 'userId')
      .addSelect('SUM(gift.amount)', 'totalAmount')
      .innerJoin('gift.sender', 'sender')
      .addSelect('sender.username', 'username')
      .addSelect('sender.displayName', 'displayName')
      .addSelect('sender.avatarUrl', 'avatarUrl')
      .where('gift.liveSessionId = :liveId', { liveId })
      .groupBy('gift.senderId')
      .addGroupBy('sender.username')
      .addGroupBy('sender.displayName')
      .addGroupBy('sender.avatarUrl')
      .orderBy('"totalAmount"', 'DESC')
      .limit(10)
      .getRawMany();

    return rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName || undefined,
      avatarUrl: r.avatarUrl || undefined,
      totalAmount: Number(r.totalAmount),
    }));
  }

  // Utilise par les pages vitrine /live et /enchere : des createurs fictifs (videos de demo),
  // donc pas de vrai destinataire a créditer — le solde de l'envoyeur est reellement débité
  // (coherent avec le reste du wallet, deja reel) mais l'integralite part en platformAmount.
  async sendDemoGift(senderId: string, giftType: string): Promise<{ walletBalance: number }> {
    const amount = GIFT_CATALOG[giftType];
    if (!amount) throw new BadRequestException('Cadeau inconnu');

    const sender = await this.usersRepo.findOne({ where: { id: senderId } });
    if (!sender || Number(sender.walletBalance) < amount) {
      throw new BadRequestException('Solde insuffisant');
    }

    await this.usersRepo.decrement({ id: senderId }, 'walletBalance', amount);

    const gift = await this.giftsRepo.save(this.giftsRepo.create({
      giftType,
      senderId,
      receiverId: null,
      liveSessionId: null,
      amount,
      creatorAmount: 0,
      platformAmount: amount,
    }));

    await this.walletTxRepo.save(this.walletTxRepo.create({
      userId: senderId,
      type: WalletTransactionType.GIFT_SENT,
      amount: -amount,
      description: `Cadeau envoyé (${giftType})`,
      reference: gift.id,
    }));

    const updated = await this.usersRepo.findOne({ where: { id: senderId } });
    return { walletBalance: Number(updated!.walletBalance) };
  }

  // Jeton d'acces LiveKit pour la room video de ce live — une room par liveId. Le createur (et
  // son partenaire de duo, s'il y en a un) peut publier (camera/micro), les autres spectateurs
  // ne peuvent que recevoir le flux (canPublish: false).
  async getLiveKitToken(liveId: string, userId: string): Promise<{ token: string; url: string }> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!apiKey || !apiSecret || !url) {
      throw new BadRequestException("La diffusion video en direct n'est pas configurée sur ce serveur.");
    }

    const live = await this.livesRepo.findOne({ where: { id: liveId } });
    if (!live) throw new NotFoundException('Live introuvable');
    if (!(await this.hasViewAccess(live, userId))) {
      throw new ForbiddenException('Ce live est privé — demande à en faire partie.');
    }

    const isPublisher = live.creatorId === userId || (await this.isGuest(liveId, userId));
    const at = new AccessToken(apiKey, apiSecret, { identity: userId });
    at.addGrant({
      roomJoin: true,
      room: liveId,
      canPublish: isPublisher,
      canSubscribe: true,
      canPublishData: false,
    });

    return { token: await at.toJwt(), url };
  }

  // Coupe egalement le flux video LiveKit d'un spectateur expulse — le socket.io (chat/compteur)
  // est deja ferme par LivesGateway.handleKickUser, ceci empeche en plus de continuer a recevoir
  // la video/audio si le client ne reagit pas a l'evenement 'kicked' (ex: JS deja plante).
  // Echoue silencieusement si LiveKit n'est pas configure ou si le participant n'est plus connecte.
  async removeLiveKitParticipant(liveId: string, userId: string): Promise<void> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!apiKey || !apiSecret || !url) return;

    const roomService = new RoomServiceClient(url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), apiKey, apiSecret);
    await roomService.removeParticipant(liveId, userId).catch(() => {});
  }

  // L'invitation/la demande elles-memes ne sont que du signalement temps reel (voir LivesGateway
  // inviteDuo/respondDuo/requestDuo/respondDuoRequest) — ces methodes ne font que persister/
  // effacer l'appartenance a la liste d'invites, pour que getLiveKitToken sache qui a le droit
  // de publier et que l'etat survive a un refresh de page.
  async getGuestIds(liveId: string): Promise<string[]> {
    const rows = await this.liveGuestsRepo.find({ where: { liveId } });
    return rows.map((r) => r.userId);
  }

  // Hydrate les invites actuels d'un live (id/username/avatar) — utilise a l'arrivee sur la
  // page pour afficher tout de suite les bulles des invites deja presents, sans attendre un
  // evenement temps reel qui ne sera plus emis pour eux (ils ont rejoint avant notre connexion).
  async getGuestsHydrated(liveId: string): Promise<{ id: string; username: string; displayName?: string; avatarUrl?: string }[]> {
    const ids = await this.getGuestIds(liveId);
    if (ids.length === 0) return [];
    const users = await this.usersRepo.find({ where: { id: In(ids) } });
    return users.map((u) => ({ id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }));
  }

  async isGuest(liveId: string, userId: string): Promise<boolean> {
    return (await this.liveGuestsRepo.count({ where: { liveId, userId } })) > 0;
  }

  async addGuest(liveId: string, userId: string): Promise<void> {
    const live = await this.livesRepo.findOne({ where: { id: liveId } });
    if (!live) throw new NotFoundException('Live introuvable');
    if (live.creatorId === userId) throw new BadRequestException('Tu ne peux pas t\'inviter toi-même.');
    if (await this.isGuest(liveId, userId)) return;

    const count = await this.liveGuestsRepo.count({ where: { liveId } });
    if (count >= MAX_LIVE_GUESTS) {
      throw new BadRequestException(`Ce live a déjà atteint son maximum de ${MAX_LIVE_GUESTS} invités.`);
    }

    await this.liveGuestsRepo.save(this.liveGuestsRepo.create({ liveId, userId }));
    // Publier implique forcement de pouvoir regarder (recevoir les autres flux) — sur un live
    // prive, devenir invite accorde donc aussi l'acces visionnage, sans etape separee.
    if (live.isPrivate) await this.grantViewAccess(liveId, userId);
  }

  async removeGuest(liveId: string, userId: string): Promise<void> {
    await this.liveGuestsRepo.delete({ liveId, userId });
  }

  // Qui a le droit de REGARDER un live prive (distinct de isGuest, qui decide qui peut publier
  // sa camera). Toujours vrai pour un live public, pour le createur, ou pour un compte a qui
  // l'acces a ete accorde (invitation directe ou demande acceptee, voir LiveViewerAccess).
  async hasViewAccess(live: LiveSession, userId?: string): Promise<boolean> {
    if (!live.isPrivate) return true;
    if (!userId) return false;
    if (live.creatorId === userId) return true;
    return (await this.viewerAccessRepo.count({ where: { liveId: live.id, userId } })) > 0;
  }

  async grantViewAccess(liveId: string, userId: string): Promise<void> {
    const exists = await this.viewerAccessRepo.count({ where: { liveId, userId } });
    if (exists) return;
    await this.viewerAccessRepo.save(this.viewerAccessRepo.create({ liveId, userId }));
  }

  async revokeViewAccess(liveId: string, userId: string): Promise<void> {
    await this.viewerAccessRepo.delete({ liveId, userId });
  }
}
