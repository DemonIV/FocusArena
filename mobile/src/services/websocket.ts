import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from 'focusarena-shared';
import { WS_URL } from '../constants';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function initSocket(token: string): AppSocket {
  if (socket?.connected) return socket;

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  return socket;
}

export function getSocket(): AppSocket {
  if (!socket) throw new Error('Socket not initialized — call initSocket first');
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
