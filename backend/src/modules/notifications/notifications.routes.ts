import type { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import { RegisterPushSchema } from './notifications.schema';
import { savePushToken, clearPushToken } from './notifications.service';

export const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authGuard);

  /** POST /notifications/register — store the caller's Expo push token */
  fastify.post('/register', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;

    const parsed = RegisterPushSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      await savePushToken(userId, parsed.data.token, parsed.data.language);
      return reply.send({ ok: true });
    } catch (err) {
      request.log.error(err, 'notifications/register failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** POST /notifications/unregister — drop the caller's token (logout/opt-out) */
  fastify.post('/unregister', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      await clearPushToken(userId);
      return reply.send({ ok: true });
    } catch (err) {
      request.log.error(err, 'notifications/unregister failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
