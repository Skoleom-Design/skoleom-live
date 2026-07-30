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
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { liveId: string }) {
    const { liveId } = data;
    client.join(roomFor(liveId));
    this.socketLive.set(client.id, liveId);

    if (!this.viewers.has(liveId)) this.viewers.set(liveId, new Set());
    this.viewers.get(liveId)!.add(client.id);
    this.broadcastCount(liveId);

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
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { liveId: string }) {
    this.leaveLive(client, data.liveId);
  }

  handleDisconnect(client: Socket) {
    const liveId = this.socketLive.get(client.id);
    if (liveId) this.leaveLive(client, liveId);
  }

  private leaveLive(client: Socket, liveId: string) {
    client.leave(roomFor(liveId));
    this.viewers.get(liveId)?.delete(client.id);
    this.socketLive.delete(client.id);
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

  @SubscribeMessage('banUser')
  async handleBanUser(
    @MessageBody() data: { liveId: string; userId: string; token: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user || !(await this.livesService.isOwner(data.liveId, user.id))) return;

    if (!this.banned.has(data.liveId)) this.banned.set(data.liveId, new Set());
    this.banned.get(data.liveId)!.add(data.userId);
    this.server.to(roomFor(data.liveId)).emit('userBanned', { userId: data.userId });
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
}
