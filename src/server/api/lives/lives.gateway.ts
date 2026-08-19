import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody,
  ConnectedSocket, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { LivesService } from './lives.service';
import { LiveSession } from './live-session.entity';

function roomFor(liveId: string): string {
  return `live:${liveId}`;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class LivesGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private viewers = new Map<string, Set<string>>();
  private socketLive = new Map<string, string>();
  private banned = new Map<string, Set<string>>();
  // Identite des spectateurs connectes avec un token valide — sert uniquement a construire la
  // liste "inviter en duo" (voir listViewers) et a router les invitations/reponses vers le bon
  // socket. Les spectateurs anonymes ne sont jamais invitables (pas d'identite a proposer).
  private viewerIdentities = new Map<string, { liveId: string; userId: string; username: string; avatarUrl?: string }>();
  // Une seule invitation de duo en attente a la fois par live — assez pour ce cas d'usage,
  // pas besoin de gerer une file.
  private pendingDuoInvites = new Map<string, { targetUserId: string; inviterSocketId: string }>();
  // Spectateurs expulses par le createur — empeche de rejoindre le meme live une seconde fois
  // (voir handleJoin), en plus d'etre deconnectes immediatement (voir handleKickUser).
  private kicked = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private livesService: LivesService,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  private broadcastCount(liveId: string) {
    const count = this.viewers.get(liveId)?.size ?? 0;
    this.server.to(roomFor(liveId)).emit('viewerCount', { count });
  }

  private authenticate(token?: string): Promise<User | null> {
    if (!token) return Promise.resolve(null);
    try {
      const payload = this.jwtService.verify(token);
      return this.usersRepo.findOne({ where: { id: payload.sub } });
    } catch {
      return Promise.resolve(null);
    }
  }

  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { liveId: string; token?: string }) {
    const { liveId } = data;

    // Identite optionnelle — un spectateur non connecte reste anonyme, simplement non invitable
    // a un duo et non expulsable (voir listViewers/kickUser).
    const user = await this.authenticate(data.token);
    if (user && this.kicked.get(liveId)?.has(user.id)) {
      client.emit('joinError', { message: 'Tu as été exclu de ce live par le créateur.' });
      return;
    }

    client.join(roomFor(liveId));
    this.socketLive.set(client.id, liveId);

    if (!this.viewers.has(liveId)) this.viewers.set(liveId, new Set());
    this.viewers.get(liveId)!.add(client.id);
    this.broadcastCount(liveId);

    if (user) {
      this.viewerIdentities.set(client.id, {
        liveId,
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
      });
    }

    const comments = await this.livesService.getComments(liveId);
    client.emit('history', comments.map((c) => ({
      id: c.id,
      text: c.text,
      userId: c.userId,
      username: c.user.username,
      avatarUrl: c.user.avatarUrl,
      createdAt: c.createdAt,
    })));
  }

  @SubscribeMessage('leave')
  async handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { liveId: string }) {
    await this.leaveLive(client, data.liveId);
  }

  async handleDisconnect(client: Socket) {
    const liveId = this.socketLive.get(client.id);
    if (liveId) await this.leaveLive(client, liveId);
  }

  private async leaveLive(client: Socket, liveId: string) {
    client.leave(roomFor(liveId));
    this.viewers.get(liveId)?.delete(client.id);
    this.socketLive.delete(client.id);

    // Le partenaire de duo qui quitte (onglet ferme, connexion perdue) met fin au duo tout de
    // suite, plutot que de laisser l'autre cote publier dans le vide sans que personne le sache.
    const identity = this.viewerIdentities.get(client.id);
    this.viewerIdentities.delete(client.id);
    if (identity) {
      const stillConnected = [...this.viewerIdentities.values()].some(
        (v) => v.liveId === liveId && v.userId === identity.userId,
      );
      if (!stillConnected) {
        const live = await this.livesService.getById(liveId).catch(() => null);
        if (live?.duoPartnerId === identity.userId) {
          await this.livesService.clearDuoPartner(liveId);
          this.server.to(roomFor(liveId)).emit('duoEnded', {});
        }
      }
    }

    this.broadcastCount(liveId);
  }

  @SubscribeMessage('comment')
  async handleComment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveId: string; text: string; token: string },
  ) {
    const text = data.text?.trim();
    if (!text) return;

    const user = await this.authenticate(data.token);
    if (!user) {
      client.emit('commentError', { message: 'Connecte-toi pour commenter.' });
      return;
    }
    if (this.banned.get(data.liveId)?.has(user.id)) {
      client.emit('commentError', { message: "Tu as été banni de ce live." });
      return;
    }

    const comment = await this.livesService.addComment(data.liveId, user.id, text.slice(0, 500));
    this.server.to(roomFor(data.liveId)).emit('comment', {
      id: comment.id,
      text: comment.text,
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: comment.createdAt,
    });
  }

  @SubscribeMessage('deleteComment')
  async handleDeleteComment(
    @MessageBody() data: { liveId: string; commentId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;

    await this.livesService.deleteComment(data.commentId);
    this.server.to(roomFor(data.liveId)).emit('commentDeleted', { commentId: data.commentId });
  }

  // Bascule le mute (muted: true = ne peut plus commenter, false = reactive) — remplace l'ancien
  // banUser (irreversible) par un etat qu'on peut annuler depuis le panneau spectateurs.
  @SubscribeMessage('setMuted')
  async handleSetMuted(
    @MessageBody() data: { liveId: string; userId: string; muted: boolean; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;

    if (!this.banned.has(data.liveId)) this.banned.set(data.liveId, new Set());
    if (data.muted) this.banned.get(data.liveId)!.add(data.userId);
    else this.banned.get(data.liveId)!.delete(data.userId);

    this.server.to(roomFor(data.liveId)).emit('userMuteChanged', { userId: data.userId, muted: data.muted });
  }

  // Exclusion definitive du live — coupe le chat/compteur (socket.io) et le flux video (LiveKit,
  // best-effort), et empeche de rejoindre a nouveau (voir handleJoin).
  @SubscribeMessage('kickUser')
  async handleKickUser(
    @MessageBody() data: { liveId: string; userId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;
    if (data.userId === user.id) return;

    if (!this.kicked.has(data.liveId)) this.kicked.set(data.liveId, new Set());
    this.kicked.get(data.liveId)!.add(data.userId);

    const targetSockets = [...this.viewerIdentities.entries()].filter(
      ([, v]) => v.liveId === data.liveId && v.userId === data.userId,
    );
    for (const [socketId] of targetSockets) {
      this.server.to(socketId).emit('kicked', {});
      const sock = this.server.sockets.sockets.get(socketId);
      setTimeout(() => sock?.disconnect(true), 300);
    }

    await this.livesService.removeLiveKitParticipant(data.liveId, data.userId);
  }

  // Duo façon TikTok — le createur invite un spectateur actuellement connecte (identifie, donc
  // pas un anonyme) a publier sa propre camera/micro dans la meme room. Voir setDuoPartner/
  // clearDuoPartner dans lives.service.ts et getLiveKitToken pour la permission qui en decoule.

  // Ouvert a tout spectateur identifie (pas seulement le createur) — TikTok montre aussi qui
  // regarde a tout le monde ; seul le createur voit en plus le menu moderation cote client.
  @SubscribeMessage('listViewers')
  async handleListViewers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) return;

    const banned = this.banned.get(data.liveId);
    const seen = new Map<string, { userId: string; username: string; avatarUrl?: string; muted: boolean }>();
    for (const v of this.viewerIdentities.values()) {
      if (v.liveId === data.liveId && v.userId !== user.id) {
        seen.set(v.userId, { userId: v.userId, username: v.username, avatarUrl: v.avatarUrl, muted: banned?.has(v.userId) ?? false });
      }
    }
    client.emit('viewersList', [...seen.values()]);
  }

  @SubscribeMessage('inviteDuo')
  async handleInviteDuo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveId: string; targetUserId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;

    const targetSockets = [...this.viewerIdentities.entries()].filter(
      ([, v]) => v.liveId === data.liveId && v.userId === data.targetUserId,
    );
    if (targetSockets.length === 0) {
      client.emit('duoError', { message: "Ce spectateur n'est plus connecté au live." });
      return;
    }

    this.pendingDuoInvites.set(data.liveId, { targetUserId: data.targetUserId, inviterSocketId: client.id });
    for (const [socketId] of targetSockets) {
      this.server.to(socketId).emit('duoInvite', {
        liveId: data.liveId,
        fromUsername: user.displayName || user.username,
      });
    }
  }

  @SubscribeMessage('respondDuo')
  async handleRespondDuo(
    @MessageBody() data: { liveId: string; accept: boolean; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) return;

    const pending = this.pendingDuoInvites.get(data.liveId);
    if (!pending || pending.targetUserId !== user.id) return;
    this.pendingDuoInvites.delete(data.liveId);

    if (!data.accept) {
      this.server.to(pending.inviterSocketId).emit('duoDeclined', { username: user.username });
      return;
    }

    try {
      await this.livesService.setDuoPartner(data.liveId, user.id);
      this.server.to(roomFor(data.liveId)).emit('duoStarted', {
        partnerId: user.id,
        partnerUsername: user.displayName || user.username,
        partnerAvatarUrl: user.avatarUrl,
      });
    } catch (err) {
      this.server.to(pending.inviterSocketId).emit('duoError', {
        message: err instanceof Error ? err.message : 'Duo refusé.',
      });
    }
  }

  @SubscribeMessage('endDuo')
  async handleEndDuo(@MessageBody() data: { liveId: string; token: string }) {
    const user = await this.authenticate(data.token);
    if (!user) return;

    const live = await this.livesService.getById(data.liveId).catch(() => null);
    if (!live || (live.creatorId !== user.id && live.duoPartnerId !== user.id)) return;

    await this.livesService.clearDuoPartner(data.liveId);
    this.server.to(roomFor(data.liveId)).emit('duoEnded', {});
  }

  @SubscribeMessage('placeBid')
  async handlePlaceBid(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveId: string; amount: number; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) {
      client.emit('bidError', { message: 'Connecte-toi pour enchérir.' });
      return;
    }

    try {
      const live = await this.livesService.placeBid(data.liveId, user.id, Number(data.amount));
      this.server.to(roomFor(data.liveId)).emit('bidUpdate', {
        currentBid: Number(live.currentBid),
        currentBidderId: live.currentBidderId,
        currentBidderName: live.currentBidder?.displayName || live.currentBidder?.username,
        auctionEndsAt: live.auctionEndsAt,
      });
    } catch (err) {
      client.emit('bidError', { message: err instanceof Error ? err.message : 'Enchère refusée.' });
    }
  }

  // Verifie toutes les 5s si une enchere en cours vient d'atteindre son echeance, et la regle
  // (creation de la commande gagnante + notification temps reel) sans intervention du createur.
  @Interval(5000)
  async checkExpiredAuctions() {
    const settlements = await this.livesService.settleExpiredAuctions();
    for (const s of settlements) {
      this.server.to(roomFor(s.liveId)).emit('auctionEnded', s);
    }
  }

  // Appele par le controller REST juste apres le lancement d'une nouvelle manche d'enchere,
  // pour que tous les spectateurs deja connectes voient immediatement la nouvelle capsule/mise.
  broadcastAuctionStarted(liveId: string, live: LiveSession) {
    this.server.to(roomFor(liveId)).emit('auctionStarted', {
      capsule: live.auctionCapsule,
      startingBid: Number(live.startingBid),
      currentBid: Number(live.currentBid),
      auctionEndsAt: live.auctionEndsAt,
    });
  }

  // Appele par le controller REST juste apres un changement de produit mis en avant (file de
  // vente en mode live classique), pour que tous les spectateurs voient immediatement le
  // nouveau "en vente maintenant" sans avoir a recharger la page.
  broadcastFeaturedCapsule(liveId: string, live: LiveSession) {
    this.server.to(roomFor(liveId)).emit('featuredCapsuleChanged', {
      capsuleId: live.featuredCapsuleId ?? null,
      capsule: live.featuredCapsule ?? null,
    });
  }

  // Appele par le controller REST juste apres l'envoi reussi d'un cadeau, pour que le createur
  // et tous les spectateurs le voient apparaitre en temps reel dans le fil de commentaires.
  broadcastGift(liveId: string, data: { giftType: string; username: string; displayName?: string }) {
    this.server.to(roomFor(liveId)).emit('giftSent', data);
  }
}
