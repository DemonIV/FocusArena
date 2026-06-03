import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import { authModule } from './modules/auth';
import { timerModule } from './modules/timer';
import { leaderboardModule } from './modules/leaderboard';
import { roomsModule } from './modules/rooms';
import { friendsModule } from './modules/friends';
import { achievementsModule } from './modules/achievements';
import { notificationsModule } from './modules/notifications';
import { captureException } from './shared/observability';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Report unhandled/5xx errors to Sentry without altering Fastify's response.
  app.addHook('onError', async (request, reply, error) => {
    const status = reply.statusCode || (error as { statusCode?: number }).statusCode || 500;
    if (status >= 500) {
      captureException(error, { method: request.method, url: request.url });
    }
  });

  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(jwt, { secret: process.env.JWT_SECRET! });

  await app.register(authModule, { prefix: '/auth' });
  await app.register(timerModule, { prefix: '/timer' });
  await app.register(leaderboardModule, { prefix: '/leaderboard' });
  await app.register(roomsModule, { prefix: '/rooms' });
  await app.register(friendsModule, { prefix: '/friends' });
  await app.register(achievementsModule, { prefix: '/achievements' });
  await app.register(notificationsModule, { prefix: '/notifications' });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return app;
}
