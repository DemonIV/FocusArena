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

// ─── Titles (ünvanlar) ────────────────────────────────────────
// Selectable display titles shown on the profile. Each is unlocked by earning
// the matching badge (or always available when `requires` is null). Labels are
// localized on the client via the `titles.<id>` i18n keys — the backend only
// owns the unlock rule + icon.

export const TITLE_IDS = [
  'novice',       // always unlocked (default)
  'focused',      // first_session
  'roller',       // streak_3
  'week_warrior', // streak_7
  'iron_will',    // streak_30
  'centurion',    // hours_100
  'elite',        // level_10
  'social',       // social_butterfly
  'pro',          // pro_member
] as const;

export type TitleId = (typeof TITLE_IDS)[number];

export interface TitleMeta {
  /** Badge that unlocks this title; null = always available. */
  requires: BadgeType | null;
  icon: string;
}

export const TITLE_META: Record<TitleId, TitleMeta> = {
  novice:       { requires: null,               icon: '🌱' },
  focused:      { requires: 'first_session',    icon: '🎯' },
  roller:       { requires: 'streak_3',         icon: '🔥' },
  week_warrior: { requires: 'streak_7',         icon: '⚡' },
  iron_will:    { requires: 'streak_30',        icon: '💎' },
  centurion:    { requires: 'hours_100',        icon: '🏆' },
  elite:        { requires: 'level_10',         icon: '👑' },
  social:       { requires: 'social_butterfly', icon: '🦋' },
  pro:          { requires: 'pro_member',       icon: '⚜️' },
};

export interface TitleEntry {
  id: TitleId;
  icon: string;
  requires: BadgeType | null;
  unlocked: boolean;
}

// ─── Avatars (koleksiyonluk avatarlar) ────────────────────────
// Selectable cosmetic avatars shown inside the frame ring everywhere the user
// appears. Mostly earned by studying (streak / hours / sessions / mastery),
// a couple premium (Pro / seasonal). The backend owns the unlock rule + rarity;
// names/art/descriptions are localized on the client via `avatars.<id>` keys.

export const AVATAR_IDS = [
  'spark', 'comet', 'crescent',            // common
  'owl', 'fox', 'deer',                    // rare
  'nebula', 'whale', 'cat',                // epic
  'phoenix', 'dragon',                     // legend
  'nova', 'blackhole',                     // mythic
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];
export type AvatarRarity = 'common' | 'rare' | 'epic' | 'legend' | 'mythic';

/** How an avatar is unlocked — evaluated live against the user's aggregates. */
export type AvatarUnlock =
  | { kind: 'sessions'; n: number }              // total sessions (>0 min)
  | { kind: 'nightSessions'; n: number }         // sessions started 00:00–06:00 local
  | { kind: 'streak'; n: number }                // longest streak in days
  | { kind: 'hours'; n: number }                 // total focused hours
  | { kind: 'level'; n: number }                 // account level
  | { kind: 'focus'; n: number; min: number }    // n sessions with focus_score ≥ min
  | { kind: 'pro' }                              // has the pro_member badge
  | { kind: 'seasonal' };                        // Arena Pass / event grant (not yet obtainable)

export interface AvatarMeta {
  rarity: AvatarRarity;
  unlock: AvatarUnlock;
}

export const AVATAR_META: Record<AvatarId, AvatarMeta> = {
  spark:     { rarity: 'common', unlock: { kind: 'sessions', n: 1 } },
  comet:     { rarity: 'common', unlock: { kind: 'sessions', n: 5 } },
  crescent:  { rarity: 'common', unlock: { kind: 'streak', n: 3 } },
  owl:       { rarity: 'rare',   unlock: { kind: 'nightSessions', n: 10 } },
  fox:       { rarity: 'rare',   unlock: { kind: 'streak', n: 7 } },
  deer:      { rarity: 'rare',   unlock: { kind: 'hours', n: 25 } },
  nebula:    { rarity: 'epic',   unlock: { kind: 'hours', n: 100 } },
  whale:     { rarity: 'epic',   unlock: { kind: 'level', n: 10 } },
  cat:       { rarity: 'epic',   unlock: { kind: 'focus', n: 50, min: 85 } },
  phoenix:   { rarity: 'legend', unlock: { kind: 'streak', n: 100 } },
  dragon:    { rarity: 'legend', unlock: { kind: 'hours', n: 500 } },
  nova:      { rarity: 'mythic', unlock: { kind: 'pro' } },
  blackhole: { rarity: 'mythic', unlock: { kind: 'seasonal' } },
};

export interface AvatarEntry {
  id: AvatarId;
  rarity: AvatarRarity;
  unlock: AvatarUnlock;
  unlocked: boolean;
}
