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

/** A single row in the caller's local rank window (2 above + self + 2 below) */
export interface MyRankNeighbor {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  isMe: boolean;
}

export interface MyRankResponse {
  period: Period;
  rank: number | null;   // null if user has no score for the period
  score: number;
  totalUsers: number;
  username: string | null;
  avatar_url: string | null;
  /** Up to 2 entries above + self + 2 below, in rank order */
  neighbors: MyRankNeighbor[];
  /** Distinct users ranked ahead (rank - 1); null if unranked */
  ahead: number | null;
  /** Rank of the nearest higher-scored user — the next rung up; null if #1 / unranked */
  nextRank: number | null;
  /** Score gap (minutes or XP) to match that user and reach nextRank; null if #1 / unranked */
  pointsToNextRank: number | null;
}
