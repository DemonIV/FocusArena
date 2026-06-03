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

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
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
