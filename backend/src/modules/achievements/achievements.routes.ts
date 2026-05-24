import type { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import { getAchievementsWithProgress, getUserAchievements } from './achievements.service';

export const achievementsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authGuard);

  // ── GET /achievements ─────────────────────────────────────
  // Caller's full trophy cabinet: earned + locked badges
  fastify.get('/', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const result = await getAchievementsWithProgress(userId);
      return reply.send(result);
    } catch (err) {
      request.log.error(err, 'achievements GET / failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── GET /achievements/:userId ─────────────────────────────
  // Public: another user's earned badges only (no locked list)
  fastify.get('/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    try {
      const earned = await getUserAchievements(userId);
      return reply.send({ earned });
    } catch (err) {
      request.log.error(err, 'achievements GET /:userId failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
