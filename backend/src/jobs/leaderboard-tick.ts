import type Bull from 'bull';
import { getTop10ForSocket } from '../modules/leaderboard';
import { recomputeActiveFocusCount } from '../modules/timer/timer.service';
import { getSocketServer } from '../websocket';

export async function processLeaderboardTick(_job: Bull.Job): Promise<void> {
  const top10 = await getTop10ForSocket('weekly');
  // Self-heal the active-focus count against any drift from crashes / TTL expiry
  const activeCount = await recomputeActiveFocusCount().catch(() => null);

  try {
    const io = getSocketServer();
    io.emit('leaderboard:tick', { top10 });
    if (activeCount !== null) io.emit('global:activeCount', { count: activeCount });
  } catch {
    // Socket server not yet ready — skip silently; next tick will fire
  }
}
