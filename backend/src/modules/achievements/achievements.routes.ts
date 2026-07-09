import type { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import { captureException } from '../../shared/observability';
import { getAchievementsWithProgress, getUserAchievements, setSelectedTitle } from './achievements.service';
import { TITLE_IDS, type TitleId } from './achievements.schema';

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
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── PUT /achievements/title ───────────────────────────────
  // Set (or clear with null) the caller's selected profile title.
  fastify.put('/title', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const body = (request.body ?? {}) as { title?: unknown };
    const raw = body.title;

    if (raw !== null && (typeof raw !== 'string' || !TITLE_IDS.includes(raw as TitleId))) {
      return reply.code(400).send({ error: 'Validation error', message: 'Invalid title' });
    }

    try {
      const selectedTitle = await setSelectedTitle(userId, (raw ?? null) as TitleId | null);
      return reply.send({ selectedTitle });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'TITLE_LOCKED' || e.code === 'BAD_TITLE') {
        return reply.code(409).send({ error: e.code === 'BAD_TITLE' ? 'bad_title' : 'title_locked' });
      }
      request.log.error(err, 'achievements PUT /title failed');
      captureException(err, { method: request.method, url: request.url });
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
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
