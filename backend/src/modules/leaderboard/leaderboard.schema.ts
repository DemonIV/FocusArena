import { z } from 'zod';

// ─── Period ───────────────────────────────────────────────────

export const PERIODS = ['daily', 'weekly', 'monthly', 'alltime'] as const;
export type Period = (typeof PERIODS)[number];

// ─── Query Schemas ────────────────────────────────────────────

export const GlobalQuerySchema = z.object({
  period: z.enum(PERIODS).default('weekly'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const PeriodQuerySchema = z.object({
  period: z.enum(PERIODS).default('weekly'),
});

export type GlobalQuery = z.infer<typeof GlobalQuerySchema>;
export type PeriodQuery = z.infer<typeof PeriodQuerySchema>;

// ─── Response Types ───────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  /** Minutes (period) or XP (alltime) */
  score: number;
}

export interface GlobalLeaderboardResponse {
  period: Period;
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  cachedAt: string;
}

export interface FriendsLeaderboardResponse {
  period: Period;
  entries: LeaderboardEntry[];
  cachedAt: string;
}

export interface MyRankResponse {
  period: Period;
  rank: number | null;   // null if user has no score for the period
  score: number;
  totalUsers: number;
}
