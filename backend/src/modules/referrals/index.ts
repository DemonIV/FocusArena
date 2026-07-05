import type { FastifyPluginAsync } from 'fastify';
import { referralsRoutes } from './referrals.routes';

export const referralsModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(referralsRoutes);
};
