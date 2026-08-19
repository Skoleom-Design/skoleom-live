import { io, Socket } from 'socket.io-client';
import { getToken } from './http';

// Meme domaine que LivesGateway (voir src/pages/live/[id].tsx) — /socket.io/* est proxy vers
// Nest en prod par server.js, NEXT_PUBLIC_API_URL doit valoir le domaine public dans ce cas.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

// Socket unique partagé par toute l'app pour le canal temps réel "global" (notifications,
// messages privés) — namespace /rt côté serveur, distinct des rooms de live. Se (re)identifie
// automatiquement à chaque connexion/reconnexion avec le token courant.
export function getRealtimeSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (!getToken()) return null;

  if (!socket) {
    socket = io(`${API_URL}/rt`, { transports: ['websocket'] });
    socket.on('connect', () => {
      socket?.emit('identify', { token: getToken() });
    });
  }
  return socket;
}
