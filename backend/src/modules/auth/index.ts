import type { FastifyPluginAsync } from 'fastify';
import { authRoutes } from './auth.routes';

export const authModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authRoutes);
};

// Re-export guard so other modules can protect their routes
export { authGuard } from './auth.routes';
