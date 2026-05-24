import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from 'focusarena-shared';
import { supabase } from '../shared';
import type { JwtPayload } from '../modules/auth/auth.schema';
import { registerHandlers } from './handlers';

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type JwtVerifyFn = (token: string) => JwtPayload;

let io: AppServer | null = null;

// ─── Server Creation ──────────────────────────────────────────

export function createSocketServer(httpServer: HttpServer): AppServer {
  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: { origin: '*' },
      pingInterval: 25_000,
      pingTimeout: 20_000,
    },
  );
  return io;
}

export function getSocketServer(): AppServer {
  if (!io) throw new Error('Socket.io server not initialized');
  return io;
}

// ─── Handler Setup (called after buildApp) ───────────────────

/**
 * Registers the auth middleware and all per-socket event handlers.
 * Must be called after both `createSocketServer` and `buildApp` so
 * the JWT verify function is available.
 *
 * @param jwtVerify  — pass `(t) => app.jwt.verify<JwtPayload>(t)`
 */
export function setupHandlers(jwtVerify: JwtVerifyFn): void {
  const server = getSocketServer();

  // ── Auth middleware ───────────────────────────────────────
  server.use(async (socket, next) => {
    const raw: string | undefined = socket.handshake.auth?.token;
    if (!raw) return next(new Error('Authentication required'));

    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;

    try {
      const payload = jwtVerify(token);

      if (payload.type !== 'access') {
        return next(new Error('Invalid token type'));
      }

      // Fetch username from DB (SocketData requires it)
      const { data: user } = await supabase
        .from('users')
        .select('username')
        .eq('id', payload.sub)
        .single();

      socket.data.userId = payload.sub;
      socket.data.username = user?.username ?? 'unknown';

      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ────────────────────────────────────
  server.on('connection', (socket) => {
    const { userId } = socket.data;

    // Join personal room so other modules can push directly to this user
    void socket.join(`user:${userId}`);

    // Register all event handlers
    registerHandlers(server, socket);
  });
}
