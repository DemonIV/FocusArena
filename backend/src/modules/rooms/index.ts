import type { FastifyPluginAsync } from 'fastify';
import { roomsRoutes } from './rooms.routes';

export const roomsModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(roomsRoutes);
};

// Exported for use in WebSocket handler
export { getRoomMembers, setPresence } from './rooms.service';
