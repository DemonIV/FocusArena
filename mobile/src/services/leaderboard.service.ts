import { api } from './api';
import type { LeaderboardEntry, LeaderboardPeriod } from '../types';

// ── Raw API shapes ─────────────────────────────────────────────────
interface RawEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
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
    userId: e.userId,
    username: e.username,
    avatarUrl: e.avatarUrl,
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

  /** Returns the caller's own rank entry */
  getMe: async (period: LeaderboardPeriod = 'weekly'): Promise<LeaderboardEntry | null> => {
    const data = await api.get<{
      period: LeaderboardPeriod;
      rank: number | null;
      score: number;
      totalUsers: number;
      username: string;
      avatarUrl: string | null;
    }>(`/leaderboard/me?period=${period}`);
    if (data.rank === null) return null;
    return {
      rank: data.rank,
      userId: '',
      username: data.username ?? '',
      avatarUrl: data.avatarUrl ?? null,
      value: data.score,
      unit: period === 'alltime' ? 'XP' : 'min',
      isMe: true,
    };
  },
};
