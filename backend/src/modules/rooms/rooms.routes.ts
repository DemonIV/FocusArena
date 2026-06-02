import type { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import {
  CreateRoomSchema,
  UpdateRoomSchema,
  JoinRoomSchema,
  JoinByCodeSchema,
  ListRoomsQuerySchema,
} from './rooms.schema';
import {
  listPublicRooms,
  getMyRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  joinRoom,
  joinByCode,
  leaveRoom,
  regenerateInvite,
  getRoomMembers,
} from './rooms.service';
import { getSocketServer } from '../../websocket';

// Emit room:updated to all sockets in a room (best-effort)
async function broadcastRoomUpdate(roomId: string) {
  try {
    const members = await getRoomMembers(roomId);
    getSocketServer().to(`room:${roomId}`).emit('room:updated', { members });
  } catch {
    // socket server may not be ready — ignore
  }
}

export const roomsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authGuard);

  // ── GET /rooms ────────────────────────────────────────────
  fastify.get('/', async (request, reply) => {
    const parsed = ListRoomsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }
    try {
      return reply.send(await listPublicRooms(parsed.data));
    } catch (err) {
      request.log.error(err, 'rooms list failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── GET /rooms/mine ───────────────────────────────────────
  // Must be registered before /:id to avoid route conflict
  fastify.get('/mine', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      return reply.send({ rooms: await getMyRooms(userId) });
    } catch (err) {
      request.log.error(err, 'rooms/mine failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /rooms/join-by-code ──────────────────────────────
  // Must be registered before /:id to avoid route conflict
  fastify.post('/join-by-code', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const parsed = JoinByCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }
    try {
      const result = await joinByCode(userId, parsed.data);
      void broadcastRoomUpdate(result.roomId);
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      if (e.code === 'FORBIDDEN') return reply.code(403).send({ error: 'Forbidden', message: e.message });
      if (e.code === 'ROOM_FULL') return reply.code(409).send({ error: 'Conflict', message: e.message });
      if (e.code === 'ALREADY_MEMBER') return reply.code(409).send({ error: 'Conflict', message: e.message });
      request.log.error(err, 'rooms/join-by-code failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── GET /rooms/:id ────────────────────────────────────────
  fastify.get('/:id', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    try {
      return reply.send(await getRoomById(userId, id));
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      request.log.error(err, 'rooms/:id GET failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /rooms ───────────────────────────────────────────
  fastify.post('/', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const parsed = CreateRoomSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }
    try {
      const room = await createRoom(userId, parsed.data);
      return reply.code(201).send({ room });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'ROOM_LIMIT') return reply.code(409).send({ error: 'Conflict', message: e.message });
      request.log.error(err, 'rooms POST failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── PATCH /rooms/:id ──────────────────────────────────────
  fastify.patch('/:id', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const parsed = UpdateRoomSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }
    try {
      const room = await updateRoom(userId, id, parsed.data);
      void broadcastRoomUpdate(id);
      return reply.send({ room });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      if (e.code === 'FORBIDDEN') return reply.code(403).send({ error: 'Forbidden', message: e.message });
      if (e.code === 'VALIDATION') return reply.code(400).send({ error: 'Bad Request', message: e.message });
      request.log.error(err, 'rooms PATCH failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── DELETE /rooms/:id ─────────────────────────────────────
  fastify.delete('/:id', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    try {
      await deleteRoom(userId, id);
      return reply.code(204).send();
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      if (e.code === 'FORBIDDEN') return reply.code(403).send({ error: 'Forbidden', message: e.message });
      request.log.error(err, 'rooms DELETE failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /rooms/:id/join ──────────────────────────────────
  fastify.post('/:id/join', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const parsed = JoinRoomSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }
    try {
      const room = await joinRoom(userId, id, parsed.data);
      void broadcastRoomUpdate(id);
      return reply.send({ room });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      if (e.code === 'FORBIDDEN') return reply.code(403).send({ error: 'Forbidden', message: e.message });
      if (e.code === 'ROOM_FULL') return reply.code(409).send({ error: 'Conflict', message: e.message });
      if (e.code === 'ALREADY_MEMBER') return reply.code(409).send({ error: 'Conflict', message: e.message });
      request.log.error(err, 'rooms/join failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /rooms/:id/leave ─────────────────────────────────
  fastify.post('/:id/leave', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    try {
      const result = await leaveRoom(userId, id);
      if (!result.deleted) void broadcastRoomUpdate(id);
      return reply.send({ deleted: result.deleted, newOwnerId: result.newOwnerId ?? null });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      request.log.error(err, 'rooms/leave failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /rooms/:id/invite ────────────────────────────────
  fastify.post('/:id/invite', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    try {
      const invite_code = await regenerateInvite(userId, id);
      return reply.send({ invite_code });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      if (e.code === 'FORBIDDEN') return reply.code(403).send({ error: 'Forbidden', message: e.message });
      if (e.code === 'VALIDATION') return reply.code(400).send({ error: 'Bad Request', message: e.message });
      request.log.error(err, 'rooms/invite failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
