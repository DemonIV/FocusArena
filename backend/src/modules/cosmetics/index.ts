import type { FastifyPluginAsync } from 'fastify';
import { cosmeticsRoutes } from './cosmetics.routes';

export const cosmeticsModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cosmeticsRoutes);
};

export { FRAME_CATALOG } from './cosmetics.schema';
export { getSelectedFrame } from './cosmetics.service';
