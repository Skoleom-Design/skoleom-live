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
import { LivesService, MAX_LIVE_GUESTS } from './lives.service';
import { LiveSession } from './live-session.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../../shared/types/entities';

function roomFor(liveId: string): string {
  return `live:${liveId}`;
}

interface MusicState {
  youtubeId: string;
  playing: boolean;
  // Position (secondes) au moment de `updatedAt` — le client recalcule la position "live" comme
  // position + (Date.now()/1000 - updatedAt) si `playing`, evitant tout flux continu de sync.
  position: number;
  updatedAt: number; // epoch secondes
}

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

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
  // Une invitation en attente par (live, cible) — un live peut avoir plusieurs invitations en
  // cours vers des cibles differentes en meme temps (invites multiples, voir addGuest).
  private pendingDuoInvites = new Map<string, Map<string, { inviterSocketId: string }>>();
  // Demandes de duo initiees par des spectateurs (sens inverse de pendingDuoInvites) — plusieurs
  // spectateurs peuvent demander en meme temps, le createur choisit qui accepter parmi la liste.
  private pendingDuoRequests = new Map<string, Map<string, { socketId: string; username: string; avatarUrl?: string }>>();
  // Meme principe que pendingDuoRequests, mais pour l'acces VISIONNAGE d'un live prive (pas la
  // publication) — voir requestViewAccess/respondViewRequest/inviteViewer.
  private pendingViewRequests = new Map<string, Map<string, { socketId: string; username: string; avatarUrl?: string }>>();
  // Spectateurs expulses par le createur — empeche de rejoindre le meme live une seconde fois
  // (voir handleJoin), en plus d'etre deconnectes immediatement (voir handleKickUser).
  private kicked = new Map<string, Set<string>>();
  // Musique d'ambiance (YouTube) — purement du "sync de lecture" : chaque client (createur ET
  // spectateurs) charge et joue la meme video YouTube dans son propre navigateur, positionnee au
  // meme endroit (voir `position`/`updatedAt`/`playing`). Pas de mixage audio reel dans le flux
  // LiveKit (ça demanderait de re-router l'audio du createur via Web Audio API) — volontairement
  // simple : le son n'est donc pas "dans" la video du createur mais joue en parallele, cote client.
  private musicState = new Map<string, MusicState>();

  constructor(
    private jwtService: JwtService,
    private livesService: LivesService,
    private notificationsService: NotificationsService,
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

    // Enregistree avant le controle d'acces ci-dessous — sinon un spectateur refuse est
    // introuvable quand son acces est ensuite accorde (invitation ou demande acceptee), voir
    // handleInviteViewer/handleRespondViewRequest.
    if (user) {
      this.viewerIdentities.set(client.id, {
        liveId,
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
      });
    }

    const live = await this.livesService.getById(liveId).catch(() => null);
    if (!live) {
      client.emit('joinError', { message: 'Live introuvable.' });
      return;
    }
    if (!(await this.livesService.hasViewAccess(live, user?.id))) {
      client.emit('accessDenied', { message: 'Ce live est privé.', canRequest: !!user });
      return;
    }

    client.join(roomFor(liveId));
    this.socketLive.set(client.id, liveId);

    if (!this.viewers.has(liveId)) this.viewers.set(liveId, new Set());
    this.viewers.get(liveId)!.add(client.id);
    this.broadcastCount(liveId);

    const comments = await this.livesService.getComments(liveId, user?.id);
    client.emit('history', comments.map((c) => ({
      id: c.id,
      text: c.text,
      userId: c.userId,
      username: c.user.username,
      avatarUrl: c.user.avatarUrl,
      createdAt: c.createdAt,
    })));

    // Un spectateur qui rejoint alors qu'une musique tourne deja doit demarrer synchronise, pas
    // silencieux jusqu'au prochain changement (play/pause/stop) de quelqu'un d'autre.
    const music = this.musicState.get(liveId);
    if (music) client.emit('musicChanged', music);
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

    // Un invite qui quitte (onglet ferme, connexion perdue) est retire tout de suite de la
    // liste, plutot que de laisser sa camera/micro publier dans le vide sans que personne le sache.
    const identity = this.viewerIdentities.get(client.id);
    this.viewerIdentities.delete(client.id);
    if (identity) {
      const stillConnected = [...this.viewerIdentities.values()].some(
        (v) => v.liveId === liveId && v.userId === identity.userId,
      );
      if (!stillConnected) {
        // Best-effort — une erreur ici (DB transitoirement indisponible, etc.) ne doit jamais
        // faire planter tout le serveur temps reel pour tout le monde a la deconnexion d'un seul.
        const wasGuest = await this.livesService.isGuest(liveId, identity.userId).catch(() => false);
        if (wasGuest) {
          await this.livesService.removeGuest(liveId, identity.userId).catch(() => {});
          this.server.to(roomFor(liveId)).emit('duoEnded', { userId: identity.userId });
        }

        // Une invitation/demande en attente n'a plus de sens si le spectateur part —
        // on la retire pour ne pas laisser un fantome que personne ne peut plus resoudre.
        this.pendingDuoInvites.get(liveId)?.delete(identity.userId);
        if (this.pendingDuoRequests.get(liveId)?.delete(identity.userId)) {
          this.server.to(roomFor(liveId)).emit('duoRequestCancelled', { userId: identity.userId });
        }
        if (this.pendingViewRequests.get(liveId)?.delete(identity.userId)) {
          this.server.to(roomFor(liveId)).emit('viewRequestCancelled', { userId: identity.userId });
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

  // Diffuse a tout le live qu'un invite vient de rejoindre — appele a la fois quand une
  // invitation est acceptee et quand une demande est acceptee (les deux menent au meme etat).
  private broadcastGuestJoined(liveId: string, guest: { id: string; username: string; avatarUrl?: string }) {
    this.server.to(roomFor(liveId)).emit('duoStarted', {
      partnerId: guest.id,
      partnerUsername: guest.username,
      partnerAvatarUrl: guest.avatarUrl,
    });
  }

  @SubscribeMessage('inviteDuo')
  async handleInviteDuo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveId: string; targetUserId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;

    // Deja invite -> pas la peine de renvoyer une invitation.
    if (await this.livesService.isGuest(data.liveId, data.targetUserId)) return;

    const guestCount = (await this.livesService.getGuestIds(data.liveId)).length;
    if (guestCount >= MAX_LIVE_GUESTS) {
      client.emit('duoError', { message: `Ce live a déjà atteint son maximum de ${MAX_LIVE_GUESTS} invités.` });
      return;
    }

    const targetSockets = [...this.viewerIdentities.entries()].filter(
      ([, v]) => v.liveId === data.liveId && v.userId === data.targetUserId,
    );
    if (targetSockets.length === 0) {
      client.emit('duoError', { message: "Ce spectateur n'est plus connecté au live." });
      return;
    }

    // Le spectateur avait deja demande a rejoindre au meme moment -> on resout directement au
    // lieu de laisser les deux en attente l'un de l'autre.
    const existingRequest = this.pendingDuoRequests.get(data.liveId)?.get(data.targetUserId);
    if (existingRequest) {
      this.pendingDuoRequests.get(data.liveId)!.delete(data.targetUserId);
      await this.livesService.addGuest(data.liveId, data.targetUserId);
      this.broadcastGuestJoined(data.liveId, { id: data.targetUserId, username: existingRequest.username, avatarUrl: existingRequest.avatarUrl });
      return;
    }

    if (!this.pendingDuoInvites.has(data.liveId)) this.pendingDuoInvites.set(data.liveId, new Map());
    this.pendingDuoInvites.get(data.liveId)!.set(data.targetUserId, { inviterSocketId: client.id });
    for (const [socketId] of targetSockets) {
      this.server.to(socketId).emit('duoInvite', {
        liveId: data.liveId,
        fromUsername: user.displayName || user.username,
      });
    }
    await this.notificationsService.notify(data.targetUserId, user.id, NotificationType.LIVE_GUEST_INVITE, { liveId: data.liveId });
  }

  @SubscribeMessage('respondDuo')
  async handleRespondDuo(
    @MessageBody() data: { liveId: string; accept: boolean; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) return;

    const pending = this.pendingDuoInvites.get(data.liveId)?.get(user.id);
    if (!pending) return;
    this.pendingDuoInvites.get(data.liveId)!.delete(user.id);

    if (!data.accept) {
      this.server.to(pending.inviterSocketId).emit('duoDeclined', { username: user.username });
      return;
    }

    try {
      await this.livesService.addGuest(data.liveId, user.id);
      this.broadcastGuestJoined(data.liveId, { id: user.id, username: user.displayName || user.username, avatarUrl: user.avatarUrl });
    } catch (err) {
      this.server.to(pending.inviterSocketId).emit('duoError', {
        message: err instanceof Error ? err.message : 'Invitation refusée.',
      });
    }
  }

  // Sens inverse d'inviteDuo — un spectateur demande lui-meme a rejoindre le live, le createur
  // voit la demande arriver (duoRequestReceived) et choisit d'accepter ou refuser.
  @SubscribeMessage('requestDuo')
  async handleRequestDuo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) {
      client.emit('duoRequestError', { message: 'Connecte-toi pour demander à rejoindre le live.' });
      return;
    }

    const live = await this.livesService.getById(data.liveId).catch(() => null);
    if (!live) return;
    if (live.creatorId === user.id) return;

    if (await this.livesService.isGuest(data.liveId, user.id)) {
      client.emit('duoRequestError', { message: 'Tu fais déjà partie des invités de ce live.' });
      return;
    }

    const guestCount = (await this.livesService.getGuestIds(data.liveId)).length;
    if (guestCount >= MAX_LIVE_GUESTS) {
      client.emit('duoRequestError', { message: `Ce live a déjà atteint son maximum de ${MAX_LIVE_GUESTS} invités.` });
      return;
    }

    // Le createur nous avait deja invite au meme moment -> on resout directement.
    const existingInvite = this.pendingDuoInvites.get(data.liveId)?.get(user.id);
    if (existingInvite) {
      this.pendingDuoInvites.get(data.liveId)!.delete(user.id);
      await this.livesService.addGuest(data.liveId, user.id);
      this.broadcastGuestJoined(data.liveId, { id: user.id, username: user.displayName || user.username, avatarUrl: user.avatarUrl });
      return;
    }

    if (!this.pendingDuoRequests.has(data.liveId)) this.pendingDuoRequests.set(data.liveId, new Map());
    this.pendingDuoRequests.get(data.liveId)!.set(user.id, {
      socketId: client.id,
      username: user.displayName || user.username,
      avatarUrl: user.avatarUrl,
    });

    client.emit('duoRequestSent', {});
    this.server.to(roomFor(data.liveId)).emit('duoRequestReceived', {
      userId: user.id,
      username: user.displayName || user.username,
      avatarUrl: user.avatarUrl,
    });
    await this.notificationsService.notify(live.creatorId, user.id, NotificationType.LIVE_GUEST_REQUEST, { liveId: data.liveId });
  }

  @SubscribeMessage('cancelDuoRequest')
  async handleCancelDuoRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) return;
    if (this.pendingDuoRequests.get(data.liveId)?.delete(user.id)) {
      this.server.to(roomFor(data.liveId)).emit('duoRequestCancelled', { userId: user.id });
    }
  }

  @SubscribeMessage('respondDuoRequest')
  async handleRespondDuoRequest(
    @MessageBody() data: { liveId: string; userId: string; accept: boolean; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;

    const requests = this.pendingDuoRequests.get(data.liveId);
    const requester = requests?.get(data.userId);
    if (!requester) return;
    requests!.delete(data.userId);

    if (!data.accept) {
      this.server.to(requester.socketId).emit('duoRequestDeclined', {});
      return;
    }

    try {
      await this.livesService.addGuest(data.liveId, data.userId);
      this.broadcastGuestJoined(data.liveId, { id: data.userId, username: requester.username, avatarUrl: requester.avatarUrl });
    } catch (err) {
      this.server.to(requester.socketId).emit('duoRequestError', {
        message: err instanceof Error ? err.message : 'Demande refusée.',
      });
    }
  }

  // Retire un invite de la liste — soit le createur en cible une precise (moderation), soit
  // un invite se retire lui-meme (pas de targetUserId, on utilise l'appelant).
  @SubscribeMessage('endDuo')
  async handleEndDuo(@MessageBody() data: { liveId: string; token: string; targetUserId?: string }) {
    const user = await this.authenticate(data.token);
    if (!user) return;

    const live = await this.livesService.getById(data.liveId).catch(() => null);
    if (!live) return;

    let targetUserId: string;
    if (data.targetUserId) {
      if (live.creatorId !== user.id) return;
      targetUserId = data.targetUserId;
    } else {
      if (!(await this.livesService.isGuest(data.liveId, user.id))) return;
      targetUserId = user.id;
    }

    await this.livesService.removeGuest(data.liveId, targetUserId);
    this.server.to(roomFor(data.liveId)).emit('duoEnded', { userId: targetUserId });
  }

  // Acces VISIONNAGE d'un live prive (distinct des invites/duo qui publient) — meme structure
  // que requestDuo/inviteDuo/respondDuoRequest, cote "regarder" plutot que "publier".

  // Le createur autorise directement quelqu'un a regarder — pas besoin qu'il soit connecte
  // (accès immédiat, décision produit confirmée), contrairement a un duo qui necessite un
  // accord de la cible puisqu'il implique de publier sa camera.
  @SubscribeMessage('inviteViewer')
  async handleInviteViewer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveId: string; targetUserId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;

    await this.livesService.grantViewAccess(data.liveId, data.targetUserId);
    await this.notificationsService.notify(data.targetUserId, user.id, NotificationType.LIVE_VIEW_INVITE, { liveId: data.liveId });

    // Si la cible a deja un socket connecte (ex: elle regardait l'ecran "demande d'acces"),
    // la prevenir tout de suite plutot que de la laisser recharger la page pour le decouvrir.
    const targetSockets = [...this.viewerIdentities.entries()].filter(
      ([, v]) => v.liveId === data.liveId && v.userId === data.targetUserId,
    );
    for (const [socketId] of targetSockets) {
      this.server.to(socketId).emit('viewAccessGranted', {});
    }
    this.pendingViewRequests.get(data.liveId)?.delete(data.targetUserId);
  }

  @SubscribeMessage('requestViewAccess')
  async handleRequestViewAccess(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) {
      client.emit('viewRequestError', { message: 'Connecte-toi pour demander à rejoindre ce live.' });
      return;
    }

    const live = await this.livesService.getById(data.liveId).catch(() => null);
    if (!live) return;
    if (!live.isPrivate || (await this.livesService.hasViewAccess(live, user.id))) {
      client.emit('viewAccessGranted', {});
      return;
    }

    if (!this.pendingViewRequests.has(data.liveId)) this.pendingViewRequests.set(data.liveId, new Map());
    this.pendingViewRequests.get(data.liveId)!.set(user.id, {
      socketId: client.id,
      username: user.displayName || user.username,
      avatarUrl: user.avatarUrl,
    });

    client.emit('viewRequestSent', {});
    this.server.to(roomFor(data.liveId)).emit('viewRequestReceived', {
      userId: user.id,
      username: user.displayName || user.username,
      avatarUrl: user.avatarUrl,
    });
    await this.notificationsService.notify(live.creatorId, user.id, NotificationType.LIVE_VIEW_REQUEST, { liveId: data.liveId });
  }

  @SubscribeMessage('respondViewRequest')
  async handleRespondViewRequest(
    @MessageBody() data: { liveId: string; userId: string; accept: boolean; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;

    const requests = this.pendingViewRequests.get(data.liveId);
    const requester = requests?.get(data.userId);
    if (!requester) return;
    requests!.delete(data.userId);

    if (!data.accept) {
      this.server.to(requester.socketId).emit('viewRequestDeclined', {});
      return;
    }

    await this.livesService.grantViewAccess(data.liveId, data.userId);
    this.server.to(requester.socketId).emit('viewAccessGranted', {});
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

  // Pousse une invitation ponctuelle a un spectateur precis pour rejoindre la partie en cours
  // (voir GameGateway pour le jeu lui-meme) — le rejoindre reste toujours possible en libre-
  // service via le bouton Jeu des que gameActive est diffuse a tout le monde ; ceci sert juste a
  // le rendre plus visible/decouvrable pour une personne en particulier. Pas de persistance, pas
  // d'accord requis (contrairement a un duo, rejoindre un lobby de jeu est sans consequence).
  @SubscribeMessage('inviteToGame')
  async handleInviteToGame(
    @MessageBody() data: { liveId: string; targetUserId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;

    const targetSockets = [...this.viewerIdentities.entries()].filter(
      ([, v]) => v.liveId === data.liveId && v.userId === data.targetUserId,
    );
    for (const [socketId] of targetSockets) {
      this.server.to(socketId).emit('gameInvite', { fromUsername: user.displayName || user.username });
    }
  }

  // Musique d'ambiance (YouTube) — reserve au createur, voir le commentaire sur `musicState` plus
  // haut pour le principe (sync de lecture cote client, pas de mixage audio reel).
  private broadcastMusic(liveId: string) {
    this.server.to(roomFor(liveId)).emit('musicChanged', this.musicState.get(liveId) ?? null);
  }

  @SubscribeMessage('setMusic')
  async handleSetMusic(@MessageBody() data: { liveId: string; youtubeId: string; token: string }) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;
    const youtubeId = (data.youtubeId || '').trim();
    if (!YOUTUBE_ID_RE.test(youtubeId)) return;

    this.musicState.set(data.liveId, { youtubeId, playing: true, position: 0, updatedAt: Date.now() / 1000 });
    this.broadcastMusic(data.liveId);
  }

  @SubscribeMessage('pauseMusic')
  async handlePauseMusic(@MessageBody() data: { liveId: string; token: string }) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;
    const state = this.musicState.get(data.liveId);
    if (!state || !state.playing) return;

    const now = Date.now() / 1000;
    this.musicState.set(data.liveId, { ...state, playing: false, position: state.position + (now - state.updatedAt), updatedAt: now });
    this.broadcastMusic(data.liveId);
  }

  @SubscribeMessage('resumeMusic')
  async handleResumeMusic(@MessageBody() data: { liveId: string; token: string }) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;
    const state = this.musicState.get(data.liveId);
    if (!state || state.playing) return;

    this.musicState.set(data.liveId, { ...state, playing: true, updatedAt: Date.now() / 1000 });
    this.broadcastMusic(data.liveId);
  }

  @SubscribeMessage('stopMusic')
  async handleStopMusic(@MessageBody() data: { liveId: string; token: string }) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;
    this.musicState.delete(data.liveId);
    this.broadcastMusic(data.liveId);
  }
}
