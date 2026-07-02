import type { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import { captureException, track } from '../../shared/observability';
import { CosmeticsError, buyFrame, getFramesForUser, selectFrame } from './cosmetics.service';

/** Map business errors to HTTP codes; anything else is a 500. */
function statusFor(code: CosmeticsError['code']): number {
  switch (code) {
    case 'unknown_frame': return 404;
    case 'not_owned': return 403;
    case 'pro_required': return 403;
    case 'already_owned': return 409;
    case 'insufficient_coins': return 402;
    case 'expired': return 410;
  }
}

export const cosmeticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authGuard);

  // ── GET /cosmetics/frames ─────────────────────────────────
  // Shop view: coin balance, equipped frame, full catalog with ownership.
  fastify.get('/frames', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const result = await getFramesForUser(userId);
      return reply.send(result);
    } catch (err) {
      request.log.error(err, 'cosmetics GET /frames failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /cosmetics/frames/:frameId/buy ───────────────────
  fastify.post('/frames/:frameId/buy', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { frameId } = request.params as { frameId: string };
    try {
      const result = await buyFrame(userId, frameId);
      track(userId, 'frame_purchased', { frameId, coinsLeft: result.coins });
      return reply.send(result);
    } catch (err) {
      if (err instanceof CosmeticsError) {
        return reply.code(statusFor(err.code)).send({ error: err.code });
      }
      request.log.error(err, 'cosmetics POST /frames/:frameId/buy failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /cosmetics/frames/select ─────────────────────────
  // Body: { frameId: string | null } — null unequips back to default.
  fastify.post('/frames/select', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { frameId } = (request.body ?? {}) as { frameId?: string | null };
    try {
      await selectFrame(userId, frameId ?? null);
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof CosmeticsError) {
        return reply.code(statusFor(err.code)).send({ error: err.code });
      }
      request.log.error(err, 'cosmetics POST /frames/select failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
