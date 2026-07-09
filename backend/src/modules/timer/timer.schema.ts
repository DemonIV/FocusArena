import { z } from 'zod';

// ─── Request Bodies ───────────────────────────────────────────

export const StartTimerSchema = z.object({
  duration: z.number().int().min(1, 'Minimum 1 minute').max(180, 'Maximum 180 minutes').default(25),
  subjectId: z.string().uuid('Invalid subject ID').optional(),
});

/**
 * Optional distraction telemetry the client gathers over the session, used to
 * compute the Focus Score. All fields default to 0 so older clients (which
 * don't send a body) still get a sensible, presence-perfect score.
 */
export const StopTimerSchema = z.object({
  /** Times the app was sent to the background while the session was running */
  exits: z.number().int().min(0).max(1000).default(0),
  /** Total ms spent outside the app while the session was running */
  awayMs: z.number().int().min(0).default(0),
  /** Times the session was paused */
  pauses: z.number().int().min(0).max(1000).default(0),
});
export type StopTimerBody = z.infer<typeof StopTimerSchema>;

export const SetTimezoneSchema = z.object({
  /** Minutes to ADD to UTC to get local time (e.g. UTC+3 → 180). ±14 h range. */
  offsetMinutes: z.number().int().min(-840).max(840),
});
export type SetTimezoneBody = z.infer<typeof SetTimezoneSchema>;

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

/** 0–100 sub-scores that make up the Focus Score (shown as a receipt breakdown). */
export interface FocusScoreBreakdown {
  /** Overall 0–100 focus quality */
  score: number;
  /** Fraction of the planned duration actually focused */
  completion: number;
  /** How much of the session was spent inside the app (away time penalised) */
  presence: number;
  /** Freedom from app-switches and pauses */
  steadiness: number;
}

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
  /** Focus Score breakdown for this session (null when the session had 0 minutes) */
  focus: FocusScoreBreakdown | null;
}

export interface DailyStat {
  date: string;               // YYYY-MM-DD
  totalMinutes: number;
  sessionsCount: number;
  completedSessions: number;
}

/**
 * "Weekly Challenge" — replaces the old global Boss Battle. Each user works
 * toward a personal weekly focus goal (coin reward on completion) and competes
 * against their friends in a weekly focus-minutes ranking.
 */
export interface WeeklyChallengeRanked {
  userId: string;
  username: string;
  minutes: number;
  /** True for the caller's own row (highlighted in the UI) */
  isMe: boolean;
}

export interface WeeklyChallengeResponse {
  /** ISO — this week's Monday 00:00 UTC */
  weekStartsAt: string;
  /** ISO — next Monday 00:00 UTC (when the challenge resets) */
  weekEndsAt: string;
  personal: {
    /** Weekly focus goal in minutes (daily-goal sum × 7) */
    goalMinutes: number;
    /** Caller's focus minutes so far this week */
    minutes: number;
    /** Coins awarded for hitting the goal */
    reward: number;
    /** minutes >= goalMinutes */
    reached: boolean;
    /** This week's reward already claimed? */
    claimed: boolean;
  };
  /** Caller + accepted friends, ranked by this week's minutes (desc) */
  friends: WeeklyChallengeRanked[];
  /** Caller's 1-based rank within `friends` */
  myRank: number;
}

/** Result of claiming the weekly personal-goal reward. */
export interface WeeklyClaimResult {
  claimed: boolean;
  coinsAwarded: number;
  newCoins: number;
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
    /** Average Focus Score across this week's scored sessions (null if none) */
    avgFocusScore: number | null;
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
