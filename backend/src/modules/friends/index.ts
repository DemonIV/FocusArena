import type { FastifyPluginAsync } from 'fastify';
import { friendsRoutes } from './friends.routes';

export const friendsModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(friendsRoutes);
};

// Exported for the WebSocket handler (presence:ping updates global user status)
export { setUserStatus, getUserStatus } from './friends.service';
