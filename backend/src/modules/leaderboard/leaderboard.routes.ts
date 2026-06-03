import type { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import { GlobalQuerySchema, PeriodQuerySchema, SetCountrySchema } from './leaderboard.schema';
import {
  getGlobalLeaderboard,
  getFriendsLeaderboard,
  getMyRank,
  getCountryWars,
  setUserCountry,
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

  // ── GET /leaderboard/countries ────────────────────────────
  // Weekly Country Wars — totals per country + caller's contribution
  fastify.get('/countries', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const result = await getCountryWars(userId);
      return reply.send(result);
    } catch (err) {
      request.log.error(err, 'leaderboard/countries failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── PUT /leaderboard/country ──────────────────────────────
  // Set the caller's country (auto-sent from the device region)
  fastify.put('/country', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;

    const parsed = SetCountrySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      await setUserCountry(userId, parsed.data.country);
      return reply.send({ ok: true });
    } catch (err) {
      request.log.error(err, 'leaderboard/country failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
