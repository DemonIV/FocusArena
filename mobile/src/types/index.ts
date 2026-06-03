// Selective re-export of non-conflicting shared types
export type { BadgeType, Achievement, Friendship, MemberStatus } from 'focusarena-shared';

// ─── Navigation ───────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Timer: undefined;
  Leaderboard: undefined;
  Rooms: undefined;
  Friends: undefined;
  Profile: undefined;
};

// ─── API Response Types ───────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  streak: number;
  longest_streak: number;
  timezone: string;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface ActiveTimerState {
  sessionId: string;
  startTime: number;
  duration: number;
  isPaused: boolean;
  pausedAt?: number;
  subjectId?: string;
  accumulatedMs: number;
}

export type TimerStatusResponse =
  | { active: false }
  | {
      active: true;
      sessionId: string;
      duration: number;
      elapsedMs: number;
      remainingMs: number;
      isPaused: boolean;
      subjectId?: string;
    };

export interface StopTimerResult {
  sessionId: string;
  durationMinutes: number;
  wasCompleted: boolean;
  xpEarned: number;
  newXp: number;
  newLevel: number;
  newStreak: number;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  daily_goal_minutes: number;
  is_active: boolean;
}

/** Subject enriched with aggregated focus time from sessions */
export interface SubjectStat {
  id: string;
  name: string;
  color: string;
  icon: string;
  totalMinutes: number;
  sessionsCount: number;
}

export interface Session {
  id: string;
  subject_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  was_completed: boolean;
}

export interface DailyStat {
  date: string;
  totalMinutes: number;
  sessionsCount: number;
  completedSessions: number;
}

/** Nested stats — matches /timer/stats response (getStats) */
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
    /** Added in migration; may be undefined until backend redeploys */
    completedSessions?: number;
    level: number;
    xp: number;
    streak: number;
    longestStreak: number;
  };
}

export interface HeatmapDay {
  date: string;          // YYYY-MM-DD (UTC)
  totalMinutes: number;
}

export interface HeatmapResponse {
  days: HeatmapDay[];    // ascending by date, gaps filled with 0
  longestStreak: number;
  currentStreak: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** Numeric score for the given period */
  value: number;
  /** 'min' | 'XP' etc. */
  unit: string;
  isMe?: boolean;
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime';

/** The caller's own rank + local context window (from /leaderboard/me) */
export interface MyRankInfo {
  rank: number | null;
  score: number;
  unit: string;
  totalUsers: number;
  /** 2 above + self + 2 below, in rank order */
  neighbors: LeaderboardEntry[];
  /** Distinct users ahead (rank - 1); null if unranked */
  ahead: number | null;
  /** Rank of the next rung up; null if #1 / unranked */
  nextRank: number | null;
  /** Score gap to reach nextRank; null if #1 / unranked */
  pointsToNextRank: number | null;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  isPublic: boolean;
  maxMembers: number;
  memberCount: number;
  createdAt: string;
  /** Present only for rooms the current user owns */
  inviteCode?: string;
}

export interface RoomMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
  joinedAt: string;
  status: 'studying' | 'break' | 'offline';
  /** Total minutes studied while in this room */
  totalMinutes: number;
}

export interface RoomDetail extends Room {
  members: RoomMember[];
  inviteCode?: string;
}

export interface FriendEntry {
  friendId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  status: 'studying' | 'break' | 'offline';
  friendsSince: string;
}

export interface FriendRequest {
  /** The other user's id — used to accept/decline (backend keys on requester id) */
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  /** 'incoming' = they sent to us, 'outgoing' = we sent to them */
  direction: 'incoming' | 'outgoing';
  status: 'pending';
  requestedAt: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  relationship: 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked';
}

/** Earned achievement (flat) */
export interface AchievementEntry {
  id: string;
  badge_type: string;
  earned_at: string;
  icon: string;
  label: string;
  description: string;
}

/** Locked achievement (not yet earned) */
export interface LockedAchievement {
  badge_type: string;
  icon: string;
  label: string;
  description: string;
}

export interface StoredTimerState {
  sessionId: string;
  startTime: number;
  duration: number;
  subjectId?: string;
  notificationId?: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}
