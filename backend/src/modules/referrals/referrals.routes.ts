import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authGuard } from '../auth';
import { redeemReferral, ReferralError } from './referrals.service';
import { captureException, track } from '../../shared/observability';

const RedeemBodySchema = z.object({
  username: z.string().trim().min(1).max(50),
});

const ERROR_STATUS: Record<ReferralError['code'], number> = {
  not_found: 404,
  self: 400,
  reverse_pair: 400,
  too_old: 403,
  already_redeemed: 409,
};

export const referralsRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /redeem ─────────────────────────────────────────────
  // New user enters the username of the friend who invited them.

  fastify.post('/redeem', { preHandler: authGuard }, async (request, reply) => {
    const parsed = RedeemBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    const userId = request.user.sub;
    try {
      const result = await redeemReferral(userId, parsed.data.username);
      track(userId, 'referral_redeemed', {
        referrer: result.referrerUsername,
        coins: result.coinsAwarded,
      });
      return reply.send(result);
    } catch (err: unknown) {
      if (err instanceof ReferralError) {
        return reply.code(ERROR_STATUS[err.code]).send({ error: err.code });
      }
      request.log.error(err, 'referral redeem failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
