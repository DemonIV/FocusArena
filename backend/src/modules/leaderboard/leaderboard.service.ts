import { supabase, redis } from '../../shared';
import type {
  Period,
  LeaderboardEntry,
  GlobalLeaderboardResponse,
  FriendsLeaderboardResponse,
  MyRankResponse,
} from './leaderboard.schema';

// ─── Cache TTLs (seconds) ─────────────────────────────────────

const CACHE_TTL: Record<Period, number> = {
  daily: 180,     // 3 min  — changes often during active hours
  weekly: 600,    // 10 min
  monthly: 1800,  // 30 min
  alltime: 300,   // 5 min  — xp updates on every session complete
};

/** Max users fetched & ranked per query (before pagination) */
const MAX_RANKED = 1000;

// ─── Cache Keys ───────────────────────────────────────────────

const cacheKey = {
  global: (period: Period) => `lb:global:${period}`,
  friends: (userId: string, period: Period) => `lb:friends:${userId}:${period}`,
};

// ─── Helpers ─────────────────────────────────────────────────

/** Returns [start, end) for the period in UTC */
function periodRange(period: Period): { start: Date; end: Date } | null {
  if (period === 'alltime') return null;

  const now = new Date();
  const end = new Date(now.getTime() + 86_400_000); // tomorrow midnight
  end.setUTCHours(0, 0, 0, 0);

  const start = new Date(end);
  if (period === 'daily') {
    start.setUTCDate(start.getUTCDate() - 1);
  } else if (period === 'weekly') {
    // Back to last Monday
    const dayOfWeek = now.getUTCDay(); // 0 Sun … 6 Sat
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceMonday - 1);
  } else {
    // monthly: 1st of this month
    start.setUTCDate(1 - 1); // = last day of prev month → adjust
    start.setUTCFullYear(now.getUTCFullYear(), now.getUTCMonth(), 1);
  }

  return { start, end };
}

/** Competition ranking: 100, 90, 90, 80 → ranks 1, 2, 2, 4 */
function assignRanks(
  sorted: Omit<LeaderboardEntry, 'rank'>[],
): LeaderboardEntry[] {
  let rank = 1;
  return sorted.map((entry, i) => {
    if (i > 0 && entry.score < sorted[i - 1].score) rank = i + 1;
    return { ...entry, rank };
  });
}

// ─── Core: fetch raw sorted list (cached) ────────────────────

async function fetchGlobalList(period: Period): Promise<LeaderboardEntry[]> {
  const key = cacheKey.global(period);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as LeaderboardEntry[];

  const list = await buildGlobalList(period);
  await redis.set(key, JSON.stringify(list), 'EX', CACHE_TTL[period]);
  return list;
}

async function buildGlobalList(period: Period): Promise<LeaderboardEntry[]> {
  if (period === 'alltime') {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, xp')
      .order('xp', { ascending: false })
      .limit(MAX_RANKED);

    if (error) throw new Error(error.message);

    const raw = (data ?? []).map((u) => ({
      user_id: u.id as string,
      username: u.username as string,
      avatar_url: u.avatar_url as string | null,
      score: u.xp as number,
    }));
    return assignRanks(raw);
  }

  const range = periodRange(period)!;

  // sessions joined with users — PostgREST resource embedding
  const { data, error } = await supabase
    .from('sessions')
    .select('user_id, duration_minutes, users!inner(username, avatar_url)')
    .gte('started_at', range.start.toISOString())
    .lt('started_at', range.end.toISOString())
    .limit(50_000); // safety cap; aggregate in JS

  if (error) throw new Error(error.message);

  // Aggregate duration_minutes per user
  const map = new Map<
    string,
    { username: string; avatar_url: string | null; score: number }
  >();

  for (const row of data ?? []) {
    const u = row.users as unknown as { username: string; avatar_url: string | null };
    const existing = map.get(row.user_id);
    if (existing) {
      existing.score += row.duration_minutes;
    } else {
      map.set(row.user_id, {
        username: u.username,
        avatar_url: u.avatar_url,
        score: row.duration_minutes,
      });
    }
  }

  const sorted = [...map.entries()]
    .map(([user_id, v]) => ({ user_id, ...v }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RANKED);

  return assignRanks(sorted);
}

// ─── Public API ───────────────────────────────────────────────

export async function getGlobalLeaderboard(
  period: Period,
  page: number,
  limit: number,
): Promise<GlobalLeaderboardResponse> {
  const list = await fetchGlobalList(period);

  const offset = (page - 1) * limit;
  const entries = list.slice(offset, offset + limit);

  return {
    period,
    entries,
    total: list.length,
    page,
    limit,
    totalPages: Math.ceil(list.length / limit),
    cachedAt: new Date().toISOString(),
  };
}

export async function getFriendsLeaderboard(
  userId: string,
  period: Period,
): Promise<FriendsLeaderboardResponse> {
  const key = cacheKey.friends(userId, period);
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as FriendsLeaderboardResponse;
  }

  // Collect accepted friend IDs (user can be either side of the friendship)
  const { data: friendships, error: fErr } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (fErr) throw new Error(fErr.message);

  const friendIds = (friendships ?? []).map((f) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id,
  );

  // Always include the requesting user themselves
  const participantIds = [userId, ...friendIds];

  // Fetch scores for these specific users from global list (or re-query if alltime)
  let entries: LeaderboardEntry[];

  if (period === 'alltime') {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, xp')
      .in('id', participantIds);

    if (error) throw new Error(error.message);

    const raw = (data ?? [])
      .map((u) => ({
        user_id: u.id as string,
        username: u.username as string,
        avatar_url: u.avatar_url as string | null,
        score: u.xp as number,
      }))
      .sort((a, b) => b.score - a.score);

    entries = assignRanks(raw);
  } else {
    const range = periodRange(period)!;

    const { data, error } = await supabase
      .from('sessions')
      .select('user_id, duration_minutes, users!inner(username, avatar_url)')
      .in('user_id', participantIds)
      .gte('started_at', range.start.toISOString())
      .lt('started_at', range.end.toISOString());

    if (error) throw new Error(error.message);

    const map = new Map<
      string,
      { username: string; avatar_url: string | null; score: number }
    >();

    for (const row of data ?? []) {
      const u = row.users as unknown as { username: string; avatar_url: string | null };
      const existing = map.get(row.user_id);
      if (existing) {
        existing.score += row.duration_minutes;
      } else {
        map.set(row.user_id, { username: u.username, avatar_url: u.avatar_url, score: row.duration_minutes });
      }
    }

    // Include friends who have zero score so they appear in the list
    for (const id of participantIds) {
      if (!map.has(id)) {
        // fetch username/avatar lazily
        const { data: u } = await supabase
          .from('users')
          .select('username, avatar_url')
          .eq('id', id)
          .single();
        if (u) map.set(id, { username: u.username, avatar_url: u.avatar_url, score: 0 });
      }
    }

    const sorted = [...map.entries()]
      .map(([user_id, v]) => ({ user_id, ...v }))
      .sort((a, b) => b.score - a.score);

    entries = assignRanks(sorted);
  }

  const result: FriendsLeaderboardResponse = {
    period,
    entries,
    cachedAt: new Date().toISOString(),
  };

  await redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL[period]);
  return result;
}

export async function getMyRank(
  userId: string,
  period: Period,
): Promise<MyRankResponse> {
  const list = await fetchGlobalList(period);

  const entry = list.find((e) => e.user_id === userId);
  return {
    period,
    rank: entry?.rank ?? null,
    score: entry?.score ?? 0,
    totalUsers: list.length,
  };
}

/**
 * Returns the top-10 entries for a period — consumed by the WS tick job.
 */
export async function getTop10ForSocket(period: Period): Promise<LeaderboardEntry[]> {
  const list = await fetchGlobalList(period);
  return list.slice(0, 10);
}

/**
 * Bust the global cache for a period (call after a session completes).
 * Friends caches expire on their own TTL.
 */
export async function invalidateCache(period: Period): Promise<void> {
  await redis.del(cacheKey.global(period));
}
