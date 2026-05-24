import { supabase, redis } from '../../shared';
import type { PublicUser } from './auth.schema';

const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ─── Supabase Auth ────────────────────────────────────────────

/**
 * Create a new Supabase auth user.
 * The DB trigger `handle_new_user` auto-inserts into public.users.
 */
export async function createAuthUser(
  email: string,
  password: string,
  username: string,
): Promise<{ id: string; email: string }> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { username },
    email_confirm: true, // skip email verification in development
  });

  if (error) throw new Error(error.message);
  return { id: data.user.id, email: data.user.email! };
}

/**
 * Validate credentials via Supabase and return the auth user.
 */
export async function signInUser(
  email: string,
  password: string,
): Promise<{ id: string; email: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) throw new Error(error.message);
  return { id: data.user.id, email: data.user.email! };
}

// ─── Public Profile ───────────────────────────────────────────

/**
 * Fetch the public user profile from the users table.
 */
export async function getUserById(userId: string): Promise<PublicUser> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, avatar_url, level, xp, streak, longest_streak, timezone, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) throw new Error(`User not found: ${userId}`);
  return data as PublicUser;
}

// ─── Redis Refresh Token Store ────────────────────────────────

/**
 * Persist a refresh token in Redis.
 * Key: `refresh:{userId}` — one active refresh token per user.
 */
export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  await redis.set(`refresh:${userId}`, token, 'EX', REFRESH_TTL_SECONDS);
}

/**
 * Verify that the supplied token matches what is stored in Redis.
 * Does NOT delete the token — call deleteRefreshToken when consuming.
 */
export async function validateRefreshToken(userId: string, token: string): Promise<boolean> {
  const stored = await redis.get(`refresh:${userId}`);
  return stored !== null && stored === token;
}

/**
 * Remove the refresh token from Redis (logout / token rotation).
 */
export async function deleteRefreshToken(userId: string): Promise<void> {
  await redis.del(`refresh:${userId}`);
}
