import Bull from 'bull';
import Redis from 'ioredis';
import { processLeaderboardTick } from './leaderboard-tick';
import { processStreakReset } from './streak-reset';
import { processSessionCleanup } from './session-cleanup';

// ─── Redis connection ─────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const isTls     = REDIS_URL.startsWith('rediss://');
const tlsOpts   = isTls ? { tls: {} } : {};

/** Bull needs maxRetriesPerRequest: null and its own ioredis instances */
function makeClient(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...tlsOpts,
  });
}

const createClient: Bull.QueueOptions['createClient'] = () => makeClient();

// ─── Shared Queue Options ─────────────────────────────────────

const sharedJobOpts: Bull.JobOptions = {
  removeOnComplete: 50,
  removeOnFail: 100,
};

// ─── Queue Definitions ────────────────────────────────────────

export const leaderboardQueue = new Bull('leaderboard-tick', { createClient, defaultJobOptions: sharedJobOpts });
export const streakQueue      = new Bull('streak-reset',     { createClient, defaultJobOptions: sharedJobOpts });
export const cleanupQueue     = new Bull('session-cleanup',  { createClient, defaultJobOptions: sharedJobOpts });

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Idempotent repeating-job scheduler.
 * Removes any existing repeatable with the same name before (re)adding
 * so server restarts don't stack duplicate schedules.
 */
async function scheduleRepeat(
  queue: Bull.Queue,
  jobName: string,
  repeatOpts: Bull.CronRepeatOptions | Bull.EveryRepeatOptions,
  jobOpts: Omit<Bull.JobOptions, 'repeat'> = {},
): Promise<void> {
  const existing = await queue.getRepeatableJobs();
  await Promise.all(
    existing
      .filter((j) => j.name === jobName)
      .map((j) => queue.removeRepeatableByKey(j.key)),
  );
  await queue.add(jobName, {}, { repeat: repeatOpts, ...jobOpts });
}

// ─── Processors ───────────────────────────────────────────────

function registerProcessors(): void {
  leaderboardQueue.process('leaderboard-tick', processLeaderboardTick);

  streakQueue.process('streak-reset', processStreakReset);

  cleanupQueue.process('session-cleanup', processSessionCleanup);

  // Global error logging for all queues
  [leaderboardQueue, streakQueue, cleanupQueue].forEach((q) => {
    q.on('failed', (job, err) => {
      console.error(`[bull] Job ${q.name}#${job.id} failed:`, err.message);
    });
  });
}

// ─── Startup ──────────────────────────────────────────────────

/**
 * Register processors and schedule all recurring jobs.
 * Call once from server.ts after the app is ready.
 */
export async function startJobs(): Promise<void> {
  registerProcessors();

  // Leaderboard tick — every 60 seconds
  await scheduleRepeat(
    leaderboardQueue,
    'leaderboard-tick',
    { every: 60_000 },
    { attempts: 1 },  // don't retry; next tick arrives soon
  );

  // Streak reset — every night at 00:05 UTC
  await scheduleRepeat(
    streakQueue,
    'streak-reset',
    { cron: '5 0 * * *', tz: 'UTC' },
    { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
  );

  // Session cleanup — every 10 minutes
  await scheduleRepeat(
    cleanupQueue,
    'session-cleanup',
    { every: 10 * 60_000 },
    { attempts: 2, backoff: { type: 'fixed', delay: 5_000 } },
  );

  console.log('[bull] All jobs scheduled ✓');
}

/**
 * Gracefully shut down all queues (call on SIGTERM/SIGINT).
 */
export async function stopJobs(): Promise<void> {
  await Promise.all([
    leaderboardQueue.close(),
    streakQueue.close(),
    cleanupQueue.close(),
  ]);
}
