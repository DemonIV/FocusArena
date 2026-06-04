import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import { captureException } from '../../shared/observability';
import { SendRequestSchema, SearchQuerySchema } from './friends.schema';
import {
  sendRequest,
  acceptRequest,
  declineRequest,
  blockUser,
  removeFriend,
  listFriends,
  listIncomingRequests,
  listSentRequests,
  listBlocked,
  searchUsers,
} from './friends.service';

// ─── Error code → HTTP status ─────────────────────────────────

function handleErr(err: unknown, reply: FastifyReply): ReturnType<FastifyReply['send']> | null {
  const e = err as { code?: string; message: string };
  if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
  if (e.code === 'DUPLICATE') return reply.code(409).send({ error: 'Conflict', message: e.message });
  if (e.code === 'FORBIDDEN') return reply.code(403).send({ error: 'Forbidden', message: e.message });
  if (e.code === 'BLOCKED') return reply.code(403).send({ error: 'Forbidden', message: e.message });
  if (e.code === 'SELF') return reply.code(400).send({ error: 'Bad Request', message: e.message });
  return null;
}

export const friendsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authGuard);

  // ── GET /friends ──────────────────────────────────────────
  fastify.get('/', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      return reply.send({ friends: await listFriends(userId) });
    } catch (err) {
      request.log.error(err, 'friends list failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── GET /friends/requests ─────────────────────────────────
  fastify.get('/requests', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      return reply.send({ requests: await listIncomingRequests(userId) });
    } catch (err) {
      request.log.error(err, 'friends/requests failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── GET /friends/sent ─────────────────────────────────────
  fastify.get('/sent', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      return reply.send({ requests: await listSentRequests(userId) });
    } catch (err) {
      request.log.error(err, 'friends/sent failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── GET /friends/blocked ──────────────────────────────────
  fastify.get('/blocked', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      return reply.send({ blocked: await listBlocked(userId) });
    } catch (err) {
      request.log.error(err, 'friends/blocked failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── GET /friends/search?q= ────────────────────────────────
  fastify.get('/search', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const parsed = SearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }
    try {
      const results = await searchUsers(userId, parsed.data.q, parsed.data.limit);
      return reply.send({ users: results });
    } catch (err) {
      request.log.error(err, 'friends/search failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /friends/request ─────────────────────────────────
  fastify.post('/request', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const parsed = SendRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }
    try {
      await sendRequest(userId, parsed.data.userId);
      return reply.code(201).send({ message: 'Friend request sent' });
    } catch (err) {
      const handled = handleErr(err, reply);
      if (handled !== null) return handled;
      request.log.error(err, 'friends/request POST failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /friends/:userId/accept ──────────────────────────
  fastify.post('/:userId/accept', async (request, reply) => {
    const { sub: callerId } = request.user as JwtPayload;
    const { userId: requesterId } = request.params as { userId: string };
    try {
      await acceptRequest(callerId, requesterId);
      return reply.send({ message: 'Friend request accepted' });
    } catch (err) {
      const handled = handleErr(err, reply);
      if (handled !== null) return handled;
      request.log.error(err, 'friends accept failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /friends/:userId/decline ─────────────────────────
  fastify.post('/:userId/decline', async (request, reply) => {
    const { sub: callerId } = request.user as JwtPayload;
    const { userId: requesterId } = request.params as { userId: string };
    try {
      await declineRequest(callerId, requesterId);
      return reply.send({ message: 'Friend request declined' });
    } catch (err) {
      const handled = handleErr(err, reply);
      if (handled !== null) return handled;
      request.log.error(err, 'friends decline failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /friends/:userId/block ───────────────────────────
  fastify.post('/:userId/block', async (request, reply) => {
    const { sub: callerId } = request.user as JwtPayload;
    const { userId: targetId } = request.params as { userId: string };
    try {
      await blockUser(callerId, targetId);
      return reply.send({ message: 'User blocked' });
    } catch (err) {
      const handled = handleErr(err, reply);
      if (handled !== null) return handled;
      request.log.error(err, 'friends block failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── DELETE /friends/:userId ───────────────────────────────
  // Removes an accepted friendship OR unblocks a blocked user
  fastify.delete('/:userId', async (request, reply) => {
    const { sub: callerId } = request.user as JwtPayload;
    const { userId: targetId } = request.params as { userId: string };
    try {
      await removeFriend(callerId, targetId);
      return reply.code(204).send();
    } catch (err) {
      const handled = handleErr(err, reply);
      if (handled !== null) return handled;
      request.log.error(err, 'friends DELETE failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
