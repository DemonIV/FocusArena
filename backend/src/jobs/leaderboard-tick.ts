import type Bull from 'bull';
import { getTop10ForSocket } from '../modules/leaderboard';
import { getSocketServer } from '../websocket';

export async function processLeaderboardTick(_job: Bull.Job): Promise<void> {
  const top10 = await getTop10ForSocket('weekly');

  try {
    const io = getSocketServer();
    io.emit('leaderboard:tick', { top10 });
  } catch {
    // Socket server not yet ready — skip silently; next tick will fire
  }
}
