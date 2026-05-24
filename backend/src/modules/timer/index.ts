import type { FastifyPluginAsync } from 'fastify';
import { timerRoutes } from './timer.routes';

export const timerModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(timerRoutes);
};
