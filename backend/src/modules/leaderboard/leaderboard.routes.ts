import type { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import { GlobalQuerySchema, PeriodQuerySchema } from './leaderboard.schema';
import {
  getGlobalLeaderboard,
  getFriendsLeaderboard,
  getMyRank,
} from './leaderboard.service';

export const leaderboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authGuard);

  // ── GET /leaderboard/global ───────────────────────────────
  // ?period=weekly&page=1&limit=50
  fastify.get('/global', async (request, reply) => {
    const parsed = GlobalQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }
    const { period, page, limit } = parsed.data;

    try {
      const result = await getGlobalLeaderboard(period, page, limit);
      return reply.send(result);
    } catch (err) {
      request.log.error(err, 'leaderboard/global failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── GET /leaderboard/friends ──────────────────────────────
  // ?period=weekly
  fastify.get('/friends', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;

    const parsed = PeriodQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const result = await getFriendsLeaderboard(userId, parsed.data.period);
      return reply.send(result);
    } catch (err) {
      request.log.error(err, 'leaderboard/friends failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── GET /leaderboard/me ───────────────────────────────────
  // ?period=weekly
  fastify.get('/me', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;

    const parsed = PeriodQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const result = await getMyRank(userId, parsed.data.period);
      return reply.send(result);
    } catch (err) {
      request.log.error(err, 'leaderboard/me failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
