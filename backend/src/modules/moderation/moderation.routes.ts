import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import { captureException } from '../../shared/observability';
import { ReportBodySchema } from './moderation.schema';
import { reportUser, hasOpenReport } from './moderation.service';

function handleErr(err: unknown, reply: FastifyReply): ReturnType<FastifyReply['send']> | null {
  const e = err as { code?: string; message: string };
  if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
  if (e.code === 'SELF') return reply.code(400).send({ error: 'Bad Request', message: e.message });
  return null;
}

export const moderationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authGuard);

  // ── POST /moderation/reports ──────────────────────────────
  // File an abuse report against another user (Guideline 1.2).
  fastify.post('/reports', async (request, reply) => {
    const { sub: reporterId } = request.user as JwtPayload;
    const parsed = ReportBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Bad Request', message: parsed.error.issues[0].message });
    }
    try {
      await reportUser(reporterId, parsed.data);
      return reply.send({ message: 'Report received' });
    } catch (err) {
      const handled = handleErr(err, reply);
      if (handled) return handled;
      request.log.error(err, 'moderation/reports failed');
      captureException(err, { route: 'POST /moderation/reports' });
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Could not file report' });
    }
  });

  // ── GET /moderation/reports/:userId ───────────────────────
  // Whether the caller already has an open report on this user.
  fastify.get('/reports/:userId', async (request, reply) => {
    const { sub: reporterId } = request.user as JwtPayload;
    const { userId } = request.params as { userId: string };
    try {
      return reply.send({ reported: await hasOpenReport(reporterId, userId) });
    } catch (err) {
      request.log.error(err, 'moderation/reports GET failed');
      captureException(err, { route: 'GET /moderation/reports/:userId' });
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Could not read report' });
    }
  });
};
