import 'dotenv/config';
import { buildApp } from './app';
import { createSocketServer, setupHandlers } from './websocket';
import { startJobs, stopJobs } from './jobs';
import type { JwtPayload } from './modules/auth/auth.schema';

const start = async () => {
  const app = await buildApp();

  // Socket.io — attach to same HTTP server, wire JWT + event handlers
  createSocketServer(app.server);
  setupHandlers((token) => app.jwt.verify<JwtPayload>(token));

  // Bull queues — schedule all recurring jobs
  await startJobs();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down…`);
    await stopJobs();
    await app.close();
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT',  () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
