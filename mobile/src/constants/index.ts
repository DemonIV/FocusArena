export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:3000';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const TIMER = {
  MIN_DURATION: 5 * 60,
  MAX_DURATION: 180 * 60,
  DEFAULT_DURATION: 25 * 60,
} as const;

export const XP = {
  PER_MINUTE: 1,
  COMPLETION_BONUS: 20,
  STREAK_MULTIPLIER: 0.1,
} as const;

export const BACKGROUND_TIMER_TASK = 'FOCUS_ARENA_TIMER_TASK';
