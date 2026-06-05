import type { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import { captureException } from '../../shared/observability';
import { verifyWebhookAuth, processWebhookEvent, getProStatus } from './billing.service';

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /billing/webhook — called by RevenueCat (NOT the app), so it is not
   * behind authGuard. Authenticated instead via the shared Authorization secret.
   */
  fastify.post('/webhook', async (request, reply) => {
    if (!verifyWebhookAuth(request.headers.authorization)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    try {
      const body = request.body as { event?: Record<string, unknown> } | undefined;
      if (body?.event) await processWebhookEvent(body.event);
      return reply.send({ ok: true });
    } catch (err) {
      request.log.error(err, 'billing/webhook failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** GET /billing/status — authenticated Pro-status read (client sync fallback). */
  fastify.get('/status', { preHandler: authGuard }, async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const status = await getProStatus(userId);
      return reply.send(status);
    } catch (err) {
      request.log.error(err, 'billing/status failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
