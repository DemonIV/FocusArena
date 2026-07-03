// ─── Badge Types ──────────────────────────────────────────────

export const BADGE_TYPES = [
  'first_session',
  'streak_3',
  'streak_7',
  'streak_30',
  'hours_10',
  'hours_100',
  'level_5',
  'level_10',
  'room_host',
  'social_butterfly',
  // Pro-exclusive — only earnable with an active Pro subscription
  'pro_member',
  'pro_marathon',
  'pro_streak_14',
] as const;

export type BadgeType = (typeof BADGE_TYPES)[number];

// ─── Check Context ────────────────────────────────────────────

/**
 * Partial snapshot of state passed to checkAndAward.
 * Each field is optional — only relevant ones need to be set.
 */
export interface AchievementContext {
  /** User had 0 XP before this session (= first ever completed session) */
  isFirstSession?: boolean;
  /** Current streak after update */
  streak?: number;
  /** Current level after update */
  level?: number;
  /** Cumulative study minutes all-time (= newXp / XP_PER_MINUTE) */
  totalMinutes?: number;
  /** User just created their first room */
  isRoomHost?: boolean;
  /** Number of accepted friends the user now has */
  friendCount?: number;
  /** User has an active Pro subscription (real entitlement, not the dev bypass) */
  isPro?: boolean;
  /** Length of the session just completed, in minutes */
  sessionMinutes?: number;
}

// ─── Response Shapes ─────────────────────────────────────────

export interface AchievementEntry {
  id: string;
  badge_type: BadgeType;
  earned_at: string;
  /** Static metadata for display */
  meta: BadgeMeta;
}

export interface BadgeMeta {
  label: string;
  description: string;
  icon: string;
}

// ─── Static Badge Metadata ────────────────────────────────────

export const BADGE_META: Record<BadgeType, BadgeMeta> = {
  first_session: {
    label: 'First Focus',
    description: 'Complete your very first study session.',
    icon: '🎯',
  },
  streak_3: {
    label: 'On a Roll',
    description: 'Maintain a 3-day study streak.',
    icon: '🔥',
  },
  streak_7: {
    label: 'Week Warrior',
    description: 'Maintain a 7-day study streak.',
    icon: '⚡',
  },
  streak_30: {
    label: 'Iron Will',
    description: 'Maintain a 30-day study streak.',
    icon: '💎',
  },
  hours_10: {
    label: 'Ten Hours In',
    description: 'Accumulate 10 total hours of focused study.',
    icon: '⏱️',
  },
  hours_100: {
    label: 'Century Scholar',
    description: 'Accumulate 100 total hours of focused study.',
    icon: '🏆',
  },
  level_5: {
    label: 'Rising Star',
    description: 'Reach level 5.',
    icon: '⭐',
  },
  level_10: {
    label: 'Elite Focuser',
    description: 'Reach level 10.',
    icon: '👑',
  },
  room_host: {
    label: 'Host',
    description: 'Create your first study room.',
    icon: '🏠',
  },
  social_butterfly: {
    label: 'Social Butterfly',
    description: 'Connect with 5 or more friends.',
    icon: '🦋',
  },
  pro_member: {
    label: 'Pro Member',
    description: 'Join StudySquad Pro.',
    icon: '👑',
  },
  pro_marathon: {
    label: 'Marathon Pro',
    description: 'Complete a 2-hour session as a Pro member.',
    icon: '🚀',
  },
  pro_streak_14: {
    label: 'Unbreakable',
    description: 'Reach a 14-day streak as a Pro member.',
    icon: '⚜️',
  },
};
