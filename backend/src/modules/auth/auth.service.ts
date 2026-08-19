import { supabase, supabaseAuth, redis } from '../../shared';
import { assertClean } from '../../shared/contentFilter';
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
  // Usernames are shown to everyone (leaderboards, rooms, friend search),
  // so they are filtered before the account exists — Guideline 1.2.
  assertClean(username, 'username');

  const { data, error } = await supabaseAuth.auth.admin.createUser({
    email,
    password,
    user_metadata: { username },
    email_confirm: true, // skip email verification in development
  });

  if (error) throw new Error(error.message);
  return { id: data.user.id, email: data.user.email! };
}

/**
 * Permanently delete a user. Removing the auth.users row cascades to
 * public.users and from there to every user-owned table (all FKs are
 * ON DELETE CASCADE), so no per-table cleanup is needed.
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  const { error } = await supabaseAuth.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

/**
 * Validate credentials via Supabase and return the auth user.
 */
export async function signInUser(
  email: string,
  password: string,
): Promise<{ id: string; email: string }> {
  // NOTE: sign-in attaches the user's session to the client it runs on —
  // must stay on the isolated supabaseAuth client, never the shared one.
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

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
 * Key for ONE sign-in session: `refresh:{userId}:{sessionId}`.
 *
 * Storing per session (instead of one token per user) is what lets the same
 * account stay signed in on several devices. With a single shared key, any
 * second sign-in silently overwrote the first device's token, and the moment
 * that device tried to refresh, the reuse guard wiped the survivor too — both
 * sessions dead, the app stuck on spinners forever.
 *
 * Tokens issued before this change carry no session id; they keep working
 * against the legacy `refresh:{userId}` key until they expire (max 7 days).
 */
function refreshKey(userId: string, sessionId?: string): string {
  return sessionId ? `refresh:${userId}:${sessionId}` : `refresh:${userId}`;
}

/** Persist a refresh token for one session. */
export async function storeRefreshToken(
  userId: string,
  token: string,
  sessionId?: string,
): Promise<void> {
  await redis.set(refreshKey(userId, sessionId), token, 'EX', REFRESH_TTL_SECONDS);
}

/**
 * Verify that the supplied token matches what is stored for this session.
 * Does NOT delete the token — call deleteRefreshToken when consuming.
 */
export async function validateRefreshToken(
  userId: string,
  token: string,
  sessionId?: string,
): Promise<boolean> {
  const stored = await redis.get(refreshKey(userId, sessionId));
  return stored !== null && stored === token;
}

/** Remove one session's refresh token (logout / rotation / reuse guard). */
export async function deleteRefreshToken(userId: string, sessionId?: string): Promise<void> {
  await redis.del(refreshKey(userId, sessionId));
}

/**
 * Remove every session of a user (account deletion). Uses SCAN rather than
 * KEYS so a growing key space never blocks Redis.
 */
export async function deleteAllRefreshTokens(userId: string): Promise<void> {
  const pattern = `refresh:${userId}*`;
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== '0');
}
