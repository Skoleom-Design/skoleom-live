import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody,
  ConnectedSocket, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { LivesService } from '../lives/lives.service';
import { LivesGateway } from '../lives/lives.gateway';
import { GameError, GameRoom, GameService, GameSettings } from './game.service';

function roomFor(code: string): string {
  return `game:${code}`;
}

// Meme convention de nom de room que LivesGateway (roomFor prive la-bas) — utilisee ici pour
// notifier les spectateurs d'un live, sur le namespace par defaut, qu'une partie vient de demarrer.
function liveRoomFor(liveId: string): string {
  return `live:${liveId}`;
}

// Meme pattern d'auth que LivesGateway : pas de handshake, chaque evenement porte son propre
// token, verifie a la volee (voir authenticate) — permet a un socket de rester anonyme tant qu'il
// n'a rien tente qui requiert une identite.
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/game' })
export class GameGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private socketRoom = new Map<string, { code: string; userId: string }>();

  constructor(
    private jwtService: JwtService,
    private gameService: GameService,
    private livesService: LivesService,
    private livesGateway: LivesGateway,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  private async authenticate(token?: string): Promise<User | null> {
    if (!token) return null;
    try {
      const payload = this.jwtService.verify(token);
      return await this.usersRepo.findOne({ where: { id: payload.sub } });
    } catch {
      return null;
    }
  }

  private broadcastState(room: GameRoom) {
    this.server.to(roomFor(room.code)).emit('roomState', this.gameService.getPublicState(room));
  }

  // Envoie a chaque joueur son role/mot en prive — jamais dans roomState (public), voir
  // GameService.getPublicState.
  private sendPrivateInfoToAll(room: GameRoom) {
    for (const player of room.players.values()) {
      if (!player.socketId) continue;
      this.server.to(player.socketId).emit('yourInfo', this.gameService.getPrivateInfo(room, player.userId));
    }
  }

  private fail(client: Socket, message: string) {
    client.emit('gameError', { message });
  }

  // Seul point d'entree desormais : le jeu ne se lance que depuis l'interieur d'un live (voir
  // src/pages/live/[id].tsx). Pas de code a saisir — la room est retrouvee/creee a partir du
  // liveId, et seul le createur du live peut en demarrer une nouvelle (voir GameService).
  @SubscribeMessage('joinLiveGame')
  async handleJoinLiveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: string; liveId: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) return this.fail(client, 'Connecte-toi pour jouer.');

    const live = await this.livesService.getById(data.liveId).catch(() => null);
    if (!live) return this.fail(client, 'Live introuvable.');

    try {
      const { room, created } = this.gameService.joinOrCreateLiveGame(
        data.liveId,
        live.creatorId === user.id,
        { userId: user.id, username: user.displayName || user.username, avatarUrl: user.avatarUrl },
        client.id,
      );
      client.join(roomFor(room.code));
      this.socketRoom.set(client.id, { code: room.code, userId: user.id });
      this.broadcastState(room);
      if (room.phase !== 'lobby') {
        client.emit('yourInfo', this.gameService.getPrivateInfo(room, user.id));
      }
      if (created) {
        this.livesGateway.server.to(liveRoomFor(data.liveId)).emit('gameActive', { active: true });
      }
    } catch (err) {
      this.fail(client, err instanceof GameError ? err.message : 'Impossible de rejoindre le jeu.');
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { token?: string; code: string }) {
    const user = await this.authenticate(data.token);
    if (!user) return;
    const room = this.gameService.leaveRoom(data.code, user.id);
    client.leave(roomFor(data.code));
    this.socketRoom.delete(client.id);
    if (room) this.broadcastState(room);
  }

  async handleDisconnect(client: Socket) {
    const entry = this.socketRoom.get(client.id);
    this.socketRoom.delete(client.id);
    if (!entry) return;
    const room = this.gameService.markDisconnected(entry.code, entry.userId);
    if (room) this.broadcastState(room);
  }

  @SubscribeMessage('updateSettings')
  async handleUpdateSettings(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: string; code: string; settings: GameSettings },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) return;
    try {
      const room = this.gameService.updateSettings(data.code, user.id, data.settings);
      this.broadcastState(room);
    } catch (err) {
      this.fail(client, err instanceof GameError ? err.message : 'Réglages refusés.');
    }
  }

  @SubscribeMessage('startGame')
  async handleStartGame(@ConnectedSocket() client: Socket, @MessageBody() data: { token?: string; code: string }) {
    const user = await this.authenticate(data.token);
    if (!user) return;
    try {
      const room = this.gameService.startGame(data.code, user.id);
      this.sendPrivateInfoToAll(room);
      this.broadcastState(room);
    } catch (err) {
      this.fail(client, err instanceof GameError ? err.message : 'Impossible de démarrer la partie.');
    }
  }

  @SubscribeMessage('submitClue')
  async handleSubmitClue(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: string; code: string; clue: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) return;
    try {
      const room = this.gameService.submitClue(data.code, user.id, data.clue);
      this.broadcastState(room);
    } catch (err) {
      this.fail(client, err instanceof GameError ? err.message : 'Indice refusé.');
    }
  }

  @SubscribeMessage('submitVote')
  async handleSubmitVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: string; code: string; targetUserId: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) return;
    try {
      const room = this.gameService.getRoom(data.code);
      const beforeLen = room?.history.length ?? 0;
      const updated = this.gameService.submitVote(data.code, user.id, data.targetUserId);
      if (updated.history.length > beforeLen) {
        this.server.to(roomFor(updated.code)).emit('roundResult', updated.history[updated.history.length - 1]);
      }
      if (updated.phase !== 'lobby') this.sendPrivateInfoToAll(updated);
      this.broadcastState(updated);
    } catch (err) {
      this.fail(client, err instanceof GameError ? err.message : 'Vote refusé.');
    }
  }

  @SubscribeMessage('mrWhiteGuess')
  async handleMrWhiteGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: string; code: string; guess: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) return;
    try {
      const room = this.gameService.mrWhiteGuess(data.code, user.id, data.guess);
      this.server.to(roomFor(room.code)).emit('mrWhiteResult', {
        userId: user.id,
        guess: data.guess,
        correct: room.winner === 'mrwhite',
      });
      this.broadcastState(room);
    } catch (err) {
      this.fail(client, err instanceof GameError ? err.message : 'Réponse refusée.');
    }
  }

  @SubscribeMessage('newRound')
  async handleNewRound(@ConnectedSocket() client: Socket, @MessageBody() data: { token?: string; code: string }) {
    const user = await this.authenticate(data.token);
    if (!user) return;
    try {
      const room = this.gameService.resetToLobby(data.code, user.id);
      this.broadcastState(room);
    } catch (err) {
      this.fail(client, err instanceof GameError ? err.message : 'Impossible de relancer une partie.');
    }
  }

  @SubscribeMessage('kickPlayer')
  async handleKickPlayer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: string; code: string; targetUserId: string },
  ) {
    const user = await this.authenticate(data.token);
    if (!user) return;
    try {
      const room = this.gameService.kickPlayer(data.code, user.id, data.targetUserId);
      const targetSocketId = [...this.socketRoom.entries()].find(
        ([, v]) => v.code === room.code && v.userId === data.targetUserId,
      )?.[0];
      if (targetSocketId) {
        this.server.to(targetSocketId).emit('kicked', {});
        this.socketRoom.delete(targetSocketId);
      }
      this.broadcastState(room);
    } catch (err) {
      this.fail(client, err instanceof GameError ? err.message : 'Exclusion refusée.');
    }
  }
}
