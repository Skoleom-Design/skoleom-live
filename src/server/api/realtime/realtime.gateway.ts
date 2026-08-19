import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody,
  ConnectedSocket, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

function roomFor(userId: string): string {
  return `user:${userId}`;
}

// Canal temps reel "global" — distinct de LivesGateway qui reste scope aux rooms de live.
// Un socket s'identifie une fois via `identify` (token JWT) puis rejoint sa room personnelle ;
// n'importe quel service peut ensuite lui pousser un evenement (notification, message prive)
// quelle que soit la page sur laquelle l'utilisateur navigue.
@WebSocketGateway({ namespace: '/rt', cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private socketUser = new Map<string, string>();

  constructor(private jwtService: JwtService) {}

  @SubscribeMessage('identify')
  handleIdentify(@ConnectedSocket() client: Socket, @MessageBody() data: { token?: string }) {
    if (!data?.token) return;
    try {
      const payload = this.jwtService.verify(data.token);
      client.join(roomFor(payload.sub));
      this.socketUser.set(client.id, payload.sub);
    } catch {
      // Token invalide/expire — le socket reste simplement non identifie, aucun evenement
      // personnel ne lui sera jamais poussé.
    }
  }

  handleDisconnect(client: Socket) {
    this.socketUser.delete(client.id);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(roomFor(userId)).emit(event, payload);
  }
}
