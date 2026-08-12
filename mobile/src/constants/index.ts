// .trim() guards against stray whitespace in .env (a trailing space makes
// fetch() build a malformed URL like "https://host /path" → every request hangs).
const env = (v: string | undefined, fallback: string) => (v?.trim() ? v.trim() : fallback);

export const API_URL = env(process.env.EXPO_PUBLIC_API_URL, 'http://localhost:3000');
export const WS_URL = env(process.env.EXPO_PUBLIC_WS_URL, 'ws://localhost:3000');
export const SUPABASE_URL = env(process.env.EXPO_PUBLIC_SUPABASE_URL, '');
export const SUPABASE_ANON_KEY = env(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, '');

/**
 * Public legal pages (served by the backend, see modules/legal).
 * App Review requires the Terms of Use + Privacy Policy to be reachable from
 * inside the purchase flow itself (App Store Guideline 3.1.2), not only from
 * the store listing.
 */
export const LEGAL_URLS = {
  privacy: `${API_URL}/legal/privacy`,
  terms: `${API_URL}/legal/terms`,
  support: `${API_URL}/legal/support`,
} as const;

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

export { FRAMES, getFrameVisual } from './frames';
export type { FrameVisual } from './frames';
export { PETS, PET_EGG_LOTTIE, PET_RARITY_COLORS, getPetVisual, getPetEmoji } from './pets';
export type { PetVisual, PetRarity } from './pets';
export { AVATAR_ORDER, AVATAR_VISUAL, RARITY_COLOR, RARITY_PARTICLES, isAvatarId } from './avatars';
export type { AvatarId, AvatarVisual, AvatarRarity } from './avatars';
