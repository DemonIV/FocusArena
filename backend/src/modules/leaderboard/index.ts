import type { FastifyPluginAsync } from 'fastify';
import { leaderboardRoutes } from './leaderboard.routes';

export const leaderboardModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(leaderboardRoutes);
};

export { getTop10ForSocket, invalidateCache } from './leaderboard.service';
