import { z } from 'zod';

// ─── Request Bodies ───────────────────────────────────────────

export const StartTimerSchema = z.object({
  duration: z.number().int().min(1, 'Minimum 1 minute').max(180, 'Maximum 180 minutes').default(25),
  subjectId: z.string().uuid('Invalid subject ID').optional(),
});

export const CreateSubjectSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color e.g. #FF5733'),
  icon: z.string().min(1),
  daily_goal_minutes: z.number().int().min(1).max(1440).default(60),
});

export const UpdateSubjectSchema = CreateSubjectSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const SessionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  subjectId: z.string().uuid().optional(),
});

// ─── Derived Types ────────────────────────────────────────────

export type StartTimerBody = z.infer<typeof StartTimerSchema>;
export type CreateSubjectBody = z.infer<typeof CreateSubjectSchema>;
export type UpdateSubjectBody = z.infer<typeof UpdateSubjectSchema>;
export type SessionQuery = z.infer<typeof SessionQuerySchema>;

// ─── Redis Timer State ────────────────────────────────────────

/** Stored in Redis under `timer:{userId}` */
export interface ActiveTimerState {
  sessionId: string;
  /** Epoch ms — when the current run segment started (reset on each resume) */
  startTime: number;
  /** Intended total duration in minutes */
  duration: number;
  isPaused: boolean;
  /** Epoch ms when paused (undefined if running) */
  pausedAt?: number;
  subjectId?: string;
  /** Total ms accumulated from all completed run segments before the current one */
  accumulatedMs: number;
}

// ─── Response Shapes ─────────────────────────────────────────

export type TimerStatusResponse =
  | { active: false }
  | {
      active: true;
      sessionId: string;
      duration: number;       // intended minutes
      elapsedMs: number;      // total elapsed ms (pauses excluded)
      remainingMs: number;    // duration*60000 - elapsedMs
      isPaused: boolean;
      subjectId?: string;
    };

export interface StopTimerResult {
  sessionId: string;
  durationMinutes: number;
  wasCompleted: boolean;
  xpEarned: number;
  /** Coins earned this session (1:1 with XP) — cosmetics currency */
  coinsEarned: number;
  newXp: number;
  newCoins: number;
  newLevel: number;
  newStreak: number;
}

export interface DailyStat {
  date: string;               // YYYY-MM-DD
  totalMinutes: number;
  sessionsCount: number;
  completedSessions: number;
}

/** "Boss Battle" — a weekly global focus goal everyone works toward together. */
export interface BossBattleResponse {
  /** Total focus minutes logged by all users this week */
  totalMinutes: number;
  /** Collective goal for the week */
  goalMinutes: number;
  /** Caller's own focus minutes this week */
  myContribution: number;
  /** Distinct users who contributed this week */
  participants: number;
  /** ISO timestamp when the weekly battle resets (next Monday 00:00 UTC) */
  weekEndsAt: string;
}

/** "Study DNA" — a personality snapshot derived from session history. */
export interface StudyDnaResponse {
  hasData: boolean;
  totalSessions: number;
  totalMinutes: number;
  avgSessionMinutes: number;
  /** Peak focus hour 0–23 (UTC) */
  peakHour: number;
  chronotype: 'night_owl' | 'early_bird' | 'daytime';
  focusStyle: 'deep' | 'sprinter' | 'steady';
  topSubject: string | null;
  superpower: 'streak' | 'volume' | 'finisher' | 'consistency';
  longestStreak: number;
}

/** "Ghost" race vs. yesterday-you, compared at the same point in the day. */
export interface GhostResponse {
  todayMinutes: number;
  /** Yesterday's cumulative minutes up to the same time-of-day */
  yesterdayMinutes: number;
  /** todayMinutes - yesterdayMinutes (positive = ahead of yesterday) */
  diff: number;
  /** Whether yesterday had any activity to race against */
  hasGhost: boolean;
}

/** One day in the activity heat map (GitHub-contribution style). */
export interface HeatmapDay {
  date: string;               // YYYY-MM-DD (UTC)
  totalMinutes: number;
}

export interface HeatmapResponse {
  days: HeatmapDay[];         // ascending by date, gaps filled with 0
  longestStreak: number;
  currentStreak: number;
}

// ─── Monthly profile stats (own or a friend's) ───────────────

export const MonthlyQuerySchema = z.object({
  /** Calendar month to aggregate, UTC. Defaults to the current month. */
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM').optional(),
  /** Whose stats to fetch. Defaults to the caller; other users require friendship. */
  userId: z.string().uuid().optional(),
});
export type MonthlyQuery = z.infer<typeof MonthlyQuerySchema>;

export interface MonthlySubjectTotal {
  /** null = bucket for sessions without a subject (or a deleted subject) */
  id: string | null;
  name: string | null;
  icon: string | null;
  color: string | null;
  totalMinutes: number;
}

export interface MonthlyDay {
  date: string;               // YYYY-MM-DD (UTC)
  totalMinutes: number;
  /** Minutes per subject id for this day ('' = no subject). Omitted when empty. */
  subjects?: Record<string, number>;
}

export interface MonthlyStatsResponse {
  user: { id: string; username: string; level: number; streak: number };
  month: string;              // YYYY-MM
  days: MonthlyDay[];         // every day of the month, ascending, zeros filled
  subjects: MonthlySubjectTotal[]; // month totals, descending by minutes
  summary: {
    totalMinutes: number;
    activeDays: number;
    sessionsCount: number;
    bestDayMinutes: number;
  };
}

export interface TimerStats {
  today: {
    totalMinutes: number;
    goalMinutes: number;
    sessionsCount: number;
    completedSessions: number;
  };
  week: {
    totalMinutes: number;
    sessionsCount: number;
    dailyBreakdown: DailyStat[];
  };
  allTime: {
    totalMinutes: number;
    totalSessions: number;
    completedSessions: number;
    level: number;
    xp: number;
    streak: number;
    longestStreak: number;
  };
}
