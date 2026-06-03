import { api } from './api';
import type { LeaderboardEntry, LeaderboardPeriod, MyRankInfo } from '../types';

// ── Raw API shapes ─────────────────────────────────────────────────
interface RawEntry {
  rank: number;
  user_id: string;        // backend returns snake_case
  username: string;
  avatar_url: string | null;
  score: number;
  isMe?: boolean;
}

interface GlobalResponse {
  period: LeaderboardPeriod;
  entries: RawEntry[];
  total: number;
  page: number;
  totalPages: number;
}

function mapEntry(e: RawEntry, period: LeaderboardPeriod): LeaderboardEntry {
  return {
    rank: e.rank,
    userId: e.user_id,
    username: e.username,
    avatarUrl: e.avatar_url,
    value: e.score,
    unit: period === 'alltime' ? 'XP' : 'min',
    isMe: e.isMe,
  };
}

// ── Service ────────────────────────────────────────────────────────
export const leaderboardService = {
  /** Returns the top-N global list for the given period */
  getGlobal: async (period: LeaderboardPeriod = 'weekly'): Promise<LeaderboardEntry[]> => {
    const data = await api.get<GlobalResponse>(
      `/leaderboard/global?period=${period}&limit=10`,
    );
    return data.entries.map((e) => mapEntry(e, period));
  },

  /** Returns friends leaderboard */
  getFriends: async (period: LeaderboardPeriod = 'weekly'): Promise<LeaderboardEntry[]> => {
    const data = await api.get<{ period: LeaderboardPeriod; entries: RawEntry[] }>(
      `/leaderboard/friends?period=${period}`,
    );
    return data.entries.map((e) => mapEntry(e, period));
  },

  /** Returns the caller's own rank + local context window */
  getMe: async (period: LeaderboardPeriod = 'weekly'): Promise<MyRankInfo | null> => {
    const data = await api.get<{
      period: LeaderboardPeriod;
      rank: number | null;
      score: number;
      totalUsers: number;
      username: string | null;
      avatar_url: string | null;
      neighbors: {
        rank: number;
        user_id: string;
        username: string;
        avatar_url: string | null;
        score: number;
        isMe: boolean;
      }[];
      ahead: number | null;
      nextRank: number | null;
      pointsToNextRank: number | null;
    }>(`/leaderboard/me?period=${period}`);

    if (data.rank === null) return null;
    const unit = period === 'alltime' ? 'XP' : 'min';

    return {
      rank: data.rank,
      score: data.score,
      unit,
      totalUsers: data.totalUsers,
      neighbors: (data.neighbors ?? []).map((n) => ({
        rank: n.rank,
        userId: n.user_id,
        username: n.username,
        avatarUrl: n.avatar_url,
        value: n.score,
        unit,
        isMe: n.isMe,
      })),
      ahead: data.ahead,
      nextRank: data.nextRank,
      pointsToNextRank: data.pointsToNextRank,
    };
  },
};
