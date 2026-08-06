import { supabase } from '../../shared';
import { getSocketServer } from '../../websocket';
import {
  BADGE_TYPES,
  BADGE_META,
  TITLE_IDS,
  TITLE_META,
  AVATAR_IDS,
  AVATAR_META,
  type BadgeType,
  type TitleId,
  type TitleEntry,
  type AvatarId,
  type AvatarUnlock,
  type AvatarEntry,
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
  pro_member:       (ctx) => ctx.isPro === true,
  pro_marathon:     (ctx) => ctx.isPro === true && (ctx.sessionMinutes ?? 0) >= 120,
  pro_streak_14:    (ctx) => ctx.isPro === true && (ctx.streak ?? 0) >= 14,
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
 * Returns all badge types with earned/locked status, plus the caller's titles
 * (unlocked/locked, derived from earned badges) and their currently selected
 * title — everything the profile trophy cabinet needs in one call.
 */
export async function getAchievementsWithProgress(userId: string): Promise<{
  earned: AchievementEntry[];
  locked: { badge_type: BadgeType; meta: (typeof BADGE_META)[BadgeType] }[];
  titles: TitleEntry[];
  selectedTitle: TitleId | null;
  avatars: AvatarEntry[];
  selectedAvatar: AvatarId | null;
}> {
  // The database lives on the other side of the planet from the app server, so
  // round trips — not rows — are what this endpoint costs. Everything it needs
  // goes out in ONE parallel batch: badges (which also carry the Pro flag) and
  // the user row (title + avatar inputs) and the session history.
  const [badgeRes, userRes, sessRes] = await Promise.all([
    supabase
      .from('achievements')
      .select('id, badge_type, earned_at')
      .eq('user_id', userId)
      .order('earned_at', { ascending: true }),
    supabase
      .from('users')
      .select('level, longest_streak, utc_offset_minutes, selected_title, selected_avatar')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('duration_minutes, started_at, focus_score')
      .eq('user_id', userId)
      .limit(20_000), // explicit cap (same shape as getStudyDNA); aggregate in JS
  ]);

  if (badgeRes.error) throw new Error(badgeRes.error.message);
  // A failed sessions read must NOT silently compute "zero of everything" —
  // that would show every avatar as locked and reject a legitimate selection.
  if (sessRes.error) throw new Error(sessRes.error.message);

  const earned: AchievementEntry[] = (badgeRes.data ?? []).map((row) => ({
    id: row.id as string,
    badge_type: row.badge_type as BadgeType,
    earned_at: row.earned_at as string,
    meta: BADGE_META[row.badge_type as BadgeType],
  }));
  const earnedSet = new Set(earned.map((e) => e.badge_type));

  const locked = BADGE_TYPES.filter((b) => !earnedSet.has(b)).map((b) => ({
    badge_type: b,
    meta: BADGE_META[b],
  }));

  const titles: TitleEntry[] = TITLE_IDS.map((id) => {
    const meta = TITLE_META[id];
    return {
      id,
      icon: meta.icon,
      requires: meta.requires,
      unlocked: meta.requires === null || earnedSet.has(meta.requires),
    };
  });

  // Selected title from the user row; ignore a stale/locked selection.
  const raw = (userRes.data?.selected_title as TitleId | null) ?? null;
  const selectedTitle = raw && titles.find((t) => t.id === raw)?.unlocked ? raw : null;

  const { avatars, selectedAvatar } = deriveAvatars(
    userRes.data,
    sessRes.data ?? [],
    earnedSet.has('pro_member'),
  );

  return { earned, locked, titles, selectedTitle, avatars, selectedAvatar };
}

// ─── Avatars ──────────────────────────────────────────────────

interface AvatarStats {
  sessions: number;
  nightSessions: number;
  streak: number;      // longest streak (days)
  hours: number;
  level: number;
  focusHigh: number;   // sessions with focus_score ≥ 85
  isPro: boolean;
}

const HIGH_FOCUS = 85;

function avatarUnlocked(u: AvatarUnlock, s: AvatarStats): boolean {
  switch (u.kind) {
    case 'sessions':      return s.sessions >= u.n;
    case 'nightSessions': return s.nightSessions >= u.n;
    case 'streak':        return s.streak >= u.n;
    case 'hours':         return s.hours >= u.n;
    case 'level':         return s.level >= u.n;
    case 'focus':         return s.focusHigh >= u.n;
    case 'pro':           return s.isPro;
    case 'seasonal':      return false; // Arena Pass / event grant — not yet obtainable
  }
}

interface AvatarUserRow {
  level?: number | null;
  longest_streak?: number | null;
  utc_offset_minutes?: number | null;
  selected_avatar?: string | null;
}

interface AvatarSessionRow {
  duration_minutes?: number | null;
  started_at?: string | null;
  focus_score?: number | null;
}

/**
 * Compute every avatar's unlock status from already-fetched rows, plus the
 * user's currently selected avatar (cleared if it points to a locked one).
 * Pure — the caller owns the queries, so a read that already has this data
 * (the profile endpoint) does not pay for a second round trip.
 */
function deriveAvatars(
  userRow: AvatarUserRow | null | undefined,
  sessionRows: AvatarSessionRow[],
  isPro: boolean,
): {
  avatars: AvatarEntry[];
  selectedAvatar: AvatarId | null;
} {
  const u = userRow;
  const offsetMin = Math.round((u?.utc_offset_minutes as number | null) ?? 0);

  let sessions = 0, nightSessions = 0, totalMin = 0, focusHigh = 0;
  for (const r of sessionRows) {
    const min = (r.duration_minutes as number | null) ?? 0;
    if (min <= 0) continue;
    sessions += 1;
    totalMin += min;
    if (((r.focus_score as number | null) ?? 0) >= HIGH_FOCUS) focusHigh += 1;
    const localHour = new Date(new Date(r.started_at as string).getTime() + offsetMin * 60_000).getUTCHours();
    if (localHour < 6) nightSessions += 1; // 00:00–06:00 local = "night"
  }

  const stats: AvatarStats = {
    sessions,
    nightSessions,
    streak: (u?.longest_streak as number | null) ?? 0,
    hours: totalMin / 60,
    level: (u?.level as number | null) ?? 0,
    focusHigh,
    isPro,
  };

  const avatars: AvatarEntry[] = AVATAR_IDS.map((id) => {
    const m = AVATAR_META[id];
    return { id, rarity: m.rarity, unlock: m.unlock, unlocked: avatarUnlocked(m.unlock, stats) };
  });

  const raw = (u?.selected_avatar as AvatarId | null) ?? null;
  const selectedAvatar = raw && avatars.find((a) => a.id === raw)?.unlocked ? raw : null;
  return { avatars, selectedAvatar };
}

/** Same numbers, but fetching their own inputs — for the selection setter. */
async function computeAvatarsForUser(userId: string): Promise<{
  avatars: AvatarEntry[];
  selectedAvatar: AvatarId | null;
}> {
  const [userRes, proRes, sessRes] = await Promise.all([
    supabase
      .from('users')
      .select('level, longest_streak, utc_offset_minutes, selected_avatar')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('achievements')
      .select('badge_type')
      .eq('user_id', userId)
      .eq('badge_type', 'pro_member')
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('duration_minutes, started_at, focus_score')
      .eq('user_id', userId)
      .limit(20_000),
  ]);

  if (sessRes.error) throw new Error(sessRes.error.message);

  return deriveAvatars(userRes.data, sessRes.data ?? [], !!proRes.data);
}

/**
 * Set (or clear, with null) the caller's selected avatar. Rejects one the user
 * hasn't unlocked. Returns the value that was persisted.
 */
export async function setSelectedAvatar(
  userId: string,
  avatar: AvatarId | null,
): Promise<AvatarId | null> {
  if (avatar !== null) {
    if (!AVATAR_IDS.includes(avatar)) {
      throw Object.assign(new Error('Unknown avatar'), { code: 'BAD_AVATAR' });
    }
    const { avatars } = await computeAvatarsForUser(userId);
    if (!avatars.find((a) => a.id === avatar)?.unlocked) {
      throw Object.assign(new Error('Avatar locked'), { code: 'AVATAR_LOCKED' });
    }
  }

  const { error } = await supabase
    .from('users')
    .update({ selected_avatar: avatar })
    .eq('id', userId);
  if (error) throw new Error(error.message);

  return avatar;
}

/**
 * Set (or clear, with null) the caller's selected profile title. Rejects a
 * title the user hasn't unlocked. Returns the value that was persisted.
 */
export async function setSelectedTitle(
  userId: string,
  title: TitleId | null,
): Promise<TitleId | null> {
  if (title !== null) {
    if (!TITLE_IDS.includes(title)) {
      throw Object.assign(new Error('Unknown title'), { code: 'BAD_TITLE' });
    }
    const meta = TITLE_META[title];
    if (meta.requires !== null) {
      const { data } = await supabase
        .from('achievements')
        .select('badge_type')
        .eq('user_id', userId)
        .eq('badge_type', meta.requires)
        .maybeSingle();
      if (!data) throw Object.assign(new Error('Title locked'), { code: 'TITLE_LOCKED' });
    }
  }

  const { error } = await supabase
    .from('users')
    .update({ selected_title: title })
    .eq('id', userId);
  if (error) throw new Error(error.message);

  return title;
}
