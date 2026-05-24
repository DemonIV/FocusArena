import type { FastifyPluginAsync } from 'fastify';
import { achievementsRoutes } from './achievements.routes';

export const achievementsModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(achievementsRoutes);
};

// Engine exported for fire-and-forget calls from other modules
export { checkAndAward } from './achievements.service';
export type { AchievementContext } from './achievements.schema';
