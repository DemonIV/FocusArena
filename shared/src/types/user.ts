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

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  daily_goal_minutes: number;
  is_active: boolean;
}

export interface Achievement {
  id: string;
  user_id: string;
  badge_type: BadgeType;
  earned_at: string;
}

export type BadgeType =
  | 'first_session'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'hours_10'
  | 'hours_100'
  | 'level_5'
  | 'level_10'
  | 'room_host'
  | 'social_butterfly'
  | 'pro_member'
  | 'pro_marathon'
  | 'pro_streak_14';
