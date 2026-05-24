import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from 'focusarena-shared';
import { supabase, redis } from '../shared';
import { startTimer, pauseTimer, stopTimer } from '../modules/timer/timer.service';
import { getRoomMembers, setPresence } from '../modules/rooms';
import { setUserStatus } from '../modules/friends';
import type { AppServer } from './index';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// ─── Helpers ─────────────────────────────────────────────────

/** Accepted friend IDs for a user */
async function getFriendIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  return (data ?? []).map((r) =>
    r.requester_id === userId ? r.addressee_id : r.requester_id,
  );
}

/** roomId values for rooms this socket has joined */
function joinedRoomIds(socket: AppSocket): string[] {
  return [...socket.rooms]
    .filter((r) => r.startsWith('room:'))
    .map((r) => r.slice('room:'.length));
}

// ─── Per-socket handler registration ─────────────────────────

export function registerHandlers(io: AppServer, socket: AppSocket): void {
  const { userId, username } = socket.data;

  // ── timer:start ───────────────────────────────────────────
  socket.on('timer:start', async ({ duration, subjectId }) => {
    try {
      const state = await startTimer(userId, duration, subjectId);
      socket.emit('timer:started', {
        sessionId: state.sessionId,
        startedAt: new Date(state.startTime).toISOString(),
      });
    } catch (err: unknown) {
      socket.emit('error:session', { message: (err as Error).message });
    }
  });

  // ── timer:pause ───────────────────────────────────────────
  // sessionId in payload is ignored; state is keyed by userId in Redis
  socket.on('timer:pause', async (_payload) => {
    try {
      await pauseTimer(userId);
    } catch (err: unknown) {
      socket.emit('error:session', { message: (err as Error).message });
    }
  });

  // ── timer:complete ────────────────────────────────────────
  // Client signals the session should end; server determines was_completed
  socket.on('timer:complete', async (_payload) => {
    try {
      await stopTimer(userId);
    } catch (err: unknown) {
      socket.emit('error:session', { message: (err as Error).message });
    }
  });

  // ── room:join ─────────────────────────────────────────────
  socket.on('room:join', async ({ roomId }) => {
    try {
      await socket.join(`room:${roomId}`);
      await setPresence(userId, roomId, 'offline');
      const members = await getRoomMembers(roomId);
      io.to(`room:${roomId}`).emit('room:updated', { members });
    } catch (err: unknown) {
      socket.emit('error:session', { message: (err as Error).message });
    }
  });

  // ── room:leave ────────────────────────────────────────────
  socket.on('room:leave', async ({ roomId }) => {
    try {
      socket.leave(`room:${roomId}`);
      await redis.del(`room:presence:${roomId}:${userId}`);
      const members = await getRoomMembers(roomId);
      io.to(`room:${roomId}`).emit('room:updated', { members });
    } catch (err: unknown) {
      socket.emit('error:session', { message: (err as Error).message });
    }
  });

  // ── presence:ping ─────────────────────────────────────────
  socket.on('presence:ping', async ({ status }) => {
    try {
      // 1. Global user status (used by friends list)
      await setUserStatus(userId, status);

      // 2. Per-room presence for every room this socket is in
      const roomIds = joinedRoomIds(socket);
      await Promise.all(roomIds.map((rid) => setPresence(userId, rid, status)));

      // 3. Broadcast status to accepted friends
      const friendIds = await getFriendIds(userId);
      for (const fid of friendIds) {
        io.to(`user:${fid}`).emit('friend:status', { userId, status });
      }
    } catch (err: unknown) {
      socket.emit('error:session', { message: (err as Error).message });
    }
  });

  // ── disconnect ────────────────────────────────────────────
  socket.on('disconnect', async () => {
    try {
      // Mark offline globally
      await setUserStatus(userId, 'offline');

      // Clear all room presences
      const roomIds = joinedRoomIds(socket);
      if (roomIds.length) {
        await Promise.all(
          roomIds.map((rid) => redis.del(`room:presence:${rid}:${userId}`)),
        );
      }

      // Notify friends
      const friendIds = await getFriendIds(userId);
      for (const fid of friendIds) {
        io.to(`user:${fid}`).emit('friend:status', { userId, status: 'offline' });
      }
    } catch {
      // disconnect handler — swallow errors silently
    }
  });

  // Suppress unused-variable warning; username is in SocketData for room display
  void username;
}
