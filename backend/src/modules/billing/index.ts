import type { FastifyPluginAsync } from 'fastify';
import { billingRoutes } from './billing.routes';

export const billingModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(billingRoutes);
};

export {
  isUserPro,
  getProStatus,
  billingEnabled,
  FREE_SUBJECT_LIMIT,
  STREAK_FREEZE_MAX,
} from './billing.service';
