// Selective re-export of non-conflicting shared types
export type { BadgeType, Achievement, Friendship, MemberStatus } from 'focusarena-shared';

// ─── Navigation ───────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
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

/** Flat stats — matches /timer/stats response */
export interface TimerStats {
  totalSessions: number;
  totalMinutes: number;
  completedSessions: number;
  averageSessionMinutes: number;
  currentStreak: number;
  longestStreak: number;
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

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  topic?: string;
  isPublic: boolean;
  maxMembers: number;
  memberCount: number;
  createdAt: string;
}

export interface RoomMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
  joinedAt: string;
  status: 'studying' | 'break' | 'offline';
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
  id: string;
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
  xp: number;
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
