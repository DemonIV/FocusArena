import type { FastifyPluginAsync } from 'fastify';
import { moderationRoutes } from './moderation.routes';

export const moderationModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(moderationRoutes);
};

export { REPORT_REASONS } from './moderation.schema';
export type { ReportReason } from './moderation.schema';
