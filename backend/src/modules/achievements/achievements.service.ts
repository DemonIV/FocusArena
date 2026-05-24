import { supabase } from '../../shared';
import { getSocketServer } from '../../websocket';
import {
  BADGE_TYPES,
  BADGE_META,
  type BadgeType,
  type AchievementContext,
  type AchievementEntry,
} from './achievements.schema';

// ─── Badge Unlock Conditions ──────────────────────────────────

const UNLOCK: Record<BadgeType, (ctx: AchievementContext) => boolean> = {
  first_session:    (ctx) => ctx.isFirstSession === true,
  streak_3:         (ctx) => (ctx.streak ?? 0) >= 3,
  streak_7:         (ctx) => (ctx.streak ?? 0) >= 7,
  streak_30:        (ctx) => (ctx.streak ?? 0) >= 30,
  hours_10:         (ctx) => (ctx.totalMinutes ?? 0) >= 600,    // 10 h × 60
  hours_100:        (ctx) => (ctx.totalMinutes ?? 0) >= 6_000,  // 100 h × 60
  level_5:          (ctx) => (ctx.level ?? 0) >= 5,
  level_10:         (ctx) => (ctx.level ?? 0) >= 10,
  room_host:        (ctx) => ctx.isRoomHost === true,
  social_butterfly: (ctx) => (ctx.friendCount ?? 0) >= 5,
};

// ─── Core Engine ──────────────────────────────────────────────

/**
 * Check all badge conditions for a user given a context snapshot.
 * Inserts any newly unlocked badges and emits `achievement:new` via Socket.io.
 * Designed to be called fire-and-forget (`void checkAndAward(...)`).
 *
 * Returns the list of newly awarded badge types.
 */
export async function checkAndAward(
  userId: string,
  ctx: AchievementContext,
): Promise<BadgeType[]> {
  // 1. Fetch already-earned badges for this user
  const { data: existing, error } = await supabase
    .from('achievements')
    .select('badge_type')
    .eq('user_id', userId);

  if (error) {
    console.error('[achievements] fetch failed:', error.message);
    return [];
  }

  const earned = new Set((existing ?? []).map((r) => r.badge_type as BadgeType));

  // 2. Find newly unlocked badges
  const toAward: BadgeType[] = BADGE_TYPES.filter(
    (badge) => !earned.has(badge) && UNLOCK[badge](ctx),
  );

  if (toAward.length === 0) return [];

  // 3. Insert in bulk (UNIQUE constraint silently handles duplicates)
  const rows = toAward.map((badge_type) => ({
    user_id: userId,
    badge_type,
    earned_at: new Date().toISOString(),
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('achievements')
    .insert(rows)
    .select('id, badge_type, earned_at');

  if (insertErr) {
    console.error('[achievements] insert failed:', insertErr.message);
    return [];
  }

  // 4. Emit socket event for each awarded badge (best-effort)
  try {
    const io = getSocketServer();
    for (const row of inserted ?? []) {
      const badge = row.badge_type as BadgeType;
      io.to(`user:${userId}`).emit('achievement:new', {
        badge: {
          id: row.id,
          user_id: userId,
          badge_type: badge,
          earned_at: row.earned_at,
        },
      });
    }
  } catch {
    // socket server may not be up — ignore
  }

  return (inserted ?? []).map((r) => r.badge_type as BadgeType);
}

// ─── Read Queries ─────────────────────────────────────────────

export async function getUserAchievements(userId: string): Promise<AchievementEntry[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('id, badge_type, earned_at')
    .eq('user_id', userId)
    .order('earned_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    badge_type: row.badge_type as BadgeType,
    earned_at: row.earned_at as string,
    meta: BADGE_META[row.badge_type as BadgeType],
  }));
}

/**
 * Returns all badge types with earned/locked status —
 * useful for a trophy-cabinet view.
 */
export async function getAchievementsWithProgress(userId: string): Promise<{
  earned: AchievementEntry[];
  locked: { badge_type: BadgeType; meta: (typeof BADGE_META)[BadgeType] }[];
}> {
  const earned = await getUserAchievements(userId);
  const earnedSet = new Set(earned.map((e) => e.badge_type));

  const locked = BADGE_TYPES.filter((b) => !earnedSet.has(b)).map((b) => ({
    badge_type: b,
    meta: BADGE_META[b],
  }));

  return { earned, locked };
}
