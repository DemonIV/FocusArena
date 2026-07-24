import { supabase, redis } from '../../shared';
import { invalidateCache, invalidateCountries } from '../leaderboard';
import { checkAndAward } from '../achievements';
import { addStudyMinutesToRooms } from '../rooms/rooms.service';
import { billingEnabled, isUserPro, getProStatus, FREE_SUBJECT_LIMIT } from '../billing';
import { notifyFriendsStudying } from '../notifications';
import { getSocketServer } from '../../websocket';
import { track } from '../../shared/observability';
import type {
  ActiveTimerState,
  TimerStatusResponse,
  StopTimerResult,
  StopTimerBody,
  FocusScoreBreakdown,
  TimerStats,
  DailyStat,
  HeatmapResponse,
  MonthlyStatsResponse,
  MonthlyDay,
  MonthlySubjectTotal,
  GhostResponse,
  StudyDnaResponse,
  WeeklyChallengeResponse,
  WeeklyChallengeRanked,
  WeeklyClaimResult,
  CreateSubjectBody,
  UpdateSubjectBody,
  SessionQuery,
} from './timer.schema';

// ─── Constants ────────────────────────────────────────────────

const TIMER_TTL = 60 * 60 * 4; // 4 hours max session in Redis
export const XP_PER_MINUTE = 10;
const XP_PER_LEVEL = 500;
/** Session is "completed" if >= 90 % of intended duration was logged */
const COMPLETION_THRESHOLD = 0.9;

const timerKey = (userId: string) => `timer:${userId}`;

// ─── Global "active focus" count ──────────────────────────────
// Number of users with a live session right now. The source of truth is the
// set of `timer:*` keys; we recount on each change (cheap at this scale) and
// broadcast over WebSocket so clients can show "N people focusing with you".

const FOCUS_COUNT_KEY = 'global:focus_count';

/** Last persisted active-focus count (0 if unknown). */
export async function getActiveFocusCount(): Promise<number> {
  const raw = await redis.get(FOCUS_COUNT_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Recount live timers from `timer:*` keys, persist, and return the total. */
export async function recomputeActiveFocusCount(): Promise<number> {
  let count = 0;
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'timer:*', 'COUNT', 200);
    cursor = next;
    count += keys.length;
  } while (cursor !== '0');
  await redis.set(FOCUS_COUNT_KEY, String(count));
  return count;
}

/** Emit the current count to every connected client (no-op if socket not ready). */
export function broadcastActiveFocusCount(count: number): void {
  try {
    getSocketServer().emit('global:activeCount', { count });
  } catch {
    // Socket server not initialised yet — periodic tick will catch up
  }
}

/** Recompute + broadcast; fire-and-forget on the request path. */
function refreshActiveFocusCount(): void {
  void recomputeActiveFocusCount()
    .then(broadcastActiveFocusCount)
    .catch((e) => console.error(`activeFocusCount refresh failed: ${e?.message}`));
}

// ─── Helpers ─────────────────────────────────────────────────

function computeLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// ─── Local-time helpers ───────────────────────────────────────
// Day/week boundaries must fall on the USER's local midnight, not UTC's, or a
// UTC+3 student's day resets at 03:00 and a 01:00 session lands on "yesterday".
// We store a fixed offset (minutes to add to UTC → local, e.g. UTC+3 = 180),
// reported by the client. A fixed offset (not an IANA zone) keeps the maths
// trivial and DST-free; the client re-reports on launch so it stays current.

const DAY_MS = 86_400_000;
/** Clamp to a sane real-world range (−14 h … +14 h). */
const clampOffset = (m: number) => Math.max(-840, Math.min(840, Math.round(m || 0)));

/** UTC instant of local midnight for the day containing `ref`, at `offsetMin`. */
function localDayStart(offsetMin: number, ref: Date = new Date()): Date {
  const shifted = new Date(ref.getTime() + offsetMin * 60_000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMin * 60_000);
}

/** UTC instant of the start of the local week (Monday) for `ref`, at `offsetMin`. */
function localWeekStart(offsetMin: number, ref: Date = new Date()): Date {
  const dayStart = localDayStart(offsetMin, ref);
  const localDow = new Date(dayStart.getTime() + offsetMin * 60_000).getUTCDay(); // 0 Sun … 6 Sat, local
  const daysSinceMonday = (localDow + 6) % 7;
  return new Date(dayStart.getTime() - daysSinceMonday * DAY_MS);
}

/** Local calendar date (YYYY-MM-DD) of a timestamp, at `offsetMin`. */
function localDateKey(ts: string | Date, offsetMin: number): string {
  const t = typeof ts === 'string' ? new Date(ts) : ts;
  return new Date(t.getTime() + offsetMin * 60_000).toISOString().slice(0, 10);
}

/** The caller's stored UTC offset in minutes (0 = UTC, the safe default). */
async function getUserOffset(userId: string): Promise<number> {
  const { data } = await supabase
    .from('users')
    .select('utc_offset_minutes')
    .eq('id', userId)
    .single();
  return clampOffset((data?.utc_offset_minutes as number | null) ?? 0);
}

/** Persist the device's current UTC offset (minutes to add to UTC → local). */
export async function setUserTimezone(userId: string, offsetMinutes: number): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ utc_offset_minutes: clampOffset(offsetMinutes) })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Focus Score (0–100) — a quality score for a single session, blending three
 * 0–100 components:
 *   • completion — how much of the planned duration was actually focused
 *   • presence   — time spent inside the app (away time penalised ~1.5×)
 *   • steadiness — freedom from app-switches (exits) and pauses
 * Rewards undistracted focus, unlike XP/coins which reward raw volume. Never
 * feeds leaderboards. Distraction inputs default to 0, so a client that sends
 * no telemetry scores on completion alone (presence/steadiness = perfect).
 */
function computeFocusScore(
  durationMinutes: number,
  intendedMinutes: number,
  { exits, awayMs, pauses }: StopTimerBody,
): FocusScoreBreakdown | null {
  if (durationMinutes <= 0) return null;

  const sessionMs = durationMinutes * 60_000;
  const completion = clamp100((durationMinutes / Math.max(1, intendedMinutes)) * 100);
  const presence = clamp100(100 - (awayMs / sessionMs) * 150);
  const steadiness = clamp100(100 - exits * 12 - pauses * 5);
  const score = clamp100(0.35 * completion + 0.35 * presence + 0.3 * steadiness);

  return { score, completion, presence, steadiness };
}

/** Total elapsed ms for a state snapshot taken right now */
function computeElapsedMs(state: ActiveTimerState): number {
  if (state.isPaused) return state.accumulatedMs;
  return state.accumulatedMs + (Date.now() - state.startTime);
}

// ─── Redis helpers ────────────────────────────────────────────

async function readState(userId: string): Promise<ActiveTimerState | null> {
  const raw = await redis.get(timerKey(userId));
  if (!raw) return null;
  return JSON.parse(raw) as ActiveTimerState;
}

async function writeState(userId: string, state: ActiveTimerState): Promise<void> {
  await redis.set(timerKey(userId), JSON.stringify(state), 'EX', TIMER_TTL);
}

async function clearState(userId: string): Promise<void> {
  await redis.del(timerKey(userId));
}

// ─── Timer Control ────────────────────────────────────────────

export async function startTimer(
  userId: string,
  duration: number,
  subjectId?: string,
): Promise<ActiveTimerState> {
  const existing = await readState(userId);
  if (existing) {
    throw Object.assign(new Error('A session is already active'), { code: 'TIMER_ACTIVE' });
  }

  // Verify subjectId belongs to user
  if (subjectId) {
    const { data } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', subjectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    if (!data) throw Object.assign(new Error('Subject not found'), { code: 'NOT_FOUND' });
  }

  // Create the DB record immediately so we can recover on restart
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      subject_id: subjectId ?? null,
      started_at: new Date().toISOString(),
      duration_minutes: 0,   // will be updated on stop
      was_completed: false,
      synced: true,
    })
    .select('id')
    .single();

  if (error || !session) throw new Error(`Failed to create session: ${error?.message}`);

  const state: ActiveTimerState = {
    sessionId: session.id,
    startTime: Date.now(),
    duration,
    isPaused: false,
    subjectId,
    accumulatedMs: 0,
  };

  await writeState(userId, state);
  refreshActiveFocusCount(); // one more user is now focusing
  void notifyFriendsStudying(userId); // "🔥 X is studying" — rate-limited inside
  return state;
}

export async function pauseTimer(userId: string): Promise<ActiveTimerState> {
  const state = await readState(userId);
  if (!state) throw Object.assign(new Error('No active session'), { code: 'NO_TIMER' });
  // Idempotent — if already paused, just return current state (handles mobile retries gracefully)
  if (state.isPaused) return state;

  const now = Date.now();
  const updated: ActiveTimerState = {
    ...state,
    accumulatedMs: state.accumulatedMs + (now - state.startTime),
    isPaused: true,
    pausedAt: now,
  };

  await writeState(userId, updated);
  return updated;
}

export async function resumeTimer(userId: string): Promise<ActiveTimerState> {
  const state = await readState(userId);
  if (!state) throw Object.assign(new Error('No active session'), { code: 'NO_TIMER' });
  // Idempotent — if already running, just return current state
  if (!state.isPaused) return state;

  const updated: ActiveTimerState = {
    ...state,
    startTime: Date.now(),
    isPaused: false,
    pausedAt: undefined,
  };

  await writeState(userId, updated);
  return updated;
}

export async function stopTimer(
  userId: string,
  telemetry: StopTimerBody = { exits: 0, awayMs: 0, pauses: 0 },
): Promise<StopTimerResult> {
  const state = await readState(userId);
  if (!state) throw Object.assign(new Error('No active session'), { code: 'NO_TIMER' });

  // A countdown session can never bank more than its set duration. If the app
  // was backgrounded/locked past the end (the JS ticker is suspended there, so
  // it can't auto-stop), the raw wall-clock elapsed balloons — cap it so a
  // 25-min timer never records hours. Completion still uses the raw elapsed.
  const rawElapsedMs = computeElapsedMs(state);
  const cappedMs = Math.min(rawElapsedMs, state.duration * 60_000);
  const durationMinutes = Math.max(0, Math.floor(cappedMs / 60_000));
  const wasCompleted = rawElapsedMs >= state.duration * 60_000 * COMPLETION_THRESHOLD;
  const focus = computeFocusScore(durationMinutes, state.duration, telemetry);

  // 🔑 Clear Redis FIRST — even if the DB update below fails, the user won't be
  // stuck with "A session is already active" on their next start attempt.
  await clearState(userId);
  refreshActiveFocusCount(); // this user stopped focusing

  // Finalise the DB session record (best-effort after Redis is cleared)
  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: new Date().toISOString(),
      duration_minutes: durationMinutes,
      was_completed: wasCompleted,
      focus_score: focus?.score ?? null,
    })
    .eq('id', state.sessionId);

  if (error) {
    // Log but don't re-throw — Redis is already cleared, no point blocking the user
    console.error(`stopTimer: DB update failed (session=${state.sessionId}): ${error.message}`);
    return { sessionId: state.sessionId, durationMinutes, wasCompleted: false, xpEarned: 0, coinsEarned: 0, newXp: 0, newCoins: 0, newLevel: 1, newStreak: 0, focus: null };
  }

  // Attribute studied minutes to every room the user is in (fire-and-forget).
  // Counts all studied time, not just "completed" sessions.
  if (durationMinutes > 0) {
    void addStudyMinutesToRooms(userId, durationMinutes).catch((e) =>
      console.error(`stopTimer: addStudyMinutesToRooms failed: ${e?.message}`),
    );
  }

  // XP + streak — only on completion
  if (!wasCompleted || durationMinutes === 0) {
    return { sessionId: state.sessionId, durationMinutes, wasCompleted, xpEarned: 0, coinsEarned: 0, newXp: 0, newCoins: 0, newLevel: 1, newStreak: 0, focus };
  }

  const result = await awardXpAndStreak(userId, state.sessionId, durationMinutes);
  result.focus = focus;

  // Bust leaderboard and aggregate caches (fire-and-forget)
  void Promise.allSettled([
    invalidateCache('daily'),
    invalidateCache('weekly'),
    invalidateCache('monthly'),
    invalidateCache('alltime'),
    invalidateCountries(),              // Country Wars weekly aggregate
  ]);

  return result;
}

/** Coins charged to save a strict-mode session after leaving the app. */
export const RESCUE_COST = 200;

/**
 * Strict-mode rescue: the user left the app during a strict session and
 * pays coins to keep it alive instead of forfeiting. The session itself
 * never stopped server-side — this only charges the fee (atomic via
 * spend_coins) and requires a live session so the endpoint can't be
 * called outside the flow.
 */
export async function rescueSession(userId: string): Promise<{ coins: number; cost: number }> {
  const state = await readState(userId);
  if (!state) throw Object.assign(new Error('No active session'), { code: 'NO_TIMER' });

  const { data, error } = await supabase.rpc('spend_coins', {
    p_user_id: userId,
    p_amount: RESCUE_COST,
  });

  if (error) {
    if (error.message.includes('insufficient_coins')) {
      throw Object.assign(new Error('Not enough coins'), { code: 'INSUFFICIENT_COINS' });
    }
    throw new Error(error.message);
  }

  return { coins: data as number, cost: RESCUE_COST };
}

export async function getTimerStatus(userId: string): Promise<TimerStatusResponse> {
  const state = await readState(userId);
  if (!state) return { active: false };

  const totalMs = state.duration * 60_000;
  const rawElapsedMs = computeElapsedMs(state);
  const elapsedMs = Math.min(rawElapsedMs, totalMs); // never report past the set duration
  const remainingMs = Math.max(0, totalMs - rawElapsedMs);

  return {
    active: true,
    sessionId: state.sessionId,
    duration: state.duration,
    elapsedMs,
    remainingMs,
    isPaused: state.isPaused,
    subjectId: state.subjectId,
  };
}

// ─── XP & Streak ─────────────────────────────────────────────

async function awardXpAndStreak(
  userId: string,
  _sessionId: string,
  durationMinutes: number,
): Promise<StopTimerResult> {
  const xpGained = durationMinutes * XP_PER_MINUTE;

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('xp, level, streak, longest_streak, coins, utc_offset_minutes')
    .eq('id', userId)
    .single();

  if (userErr || !user) throw new Error('User not found');

  const newXp = user.xp + xpGained;
  const newLevel = computeLevel(newXp);
  // Coins are the spendable cosmetics currency — earned 1:1 with XP.
  const newCoins = (user.coins ?? 0) + xpGained;

  // ── Streak logic ──────────────────────────────────────────
  // Day boundaries follow the user's local midnight, so a late-night session
  // counts toward the right day (a UTC-only "today" reset at 03:00 in Turkey).
  const offset = clampOffset((user.utc_offset_minutes as number | null) ?? 0);
  const todayUtcStart = localDayStart(offset);
  const tomorrowUtcStart = new Date(todayUtcStart.getTime() + DAY_MS);
  const yesterdayUtcStart = new Date(todayUtcStart.getTime() - DAY_MS);

  // Count completed sessions TODAY (excluding the one we just recorded)
  const { count: todayCount } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('was_completed', true)
    .gte('started_at', todayUtcStart.toISOString())
    .lt('started_at', tomorrowUtcStart.toISOString());

  let newStreak = user.streak;
  // Only update the streak on the FIRST completion of the day
  if ((todayCount ?? 0) <= 1) {
    const { count: yesterdayCount } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('was_completed', true)
      .gte('started_at', yesterdayUtcStart.toISOString())
      .lt('started_at', todayUtcStart.toISOString());

    newStreak = (yesterdayCount ?? 0) > 0 ? user.streak + 1 : 1;
  }

  const newLongestStreak = Math.max(user.longest_streak, newStreak);

  await supabase
    .from('users')
    .update({
      xp: newXp,
      level: newLevel,
      coins: newCoins,
      streak: newStreak,
      longest_streak: newLongestStreak,
    })
    .eq('id', userId);

  // Check & award achievements (fire-and-forget). Pro badges use the real
  // entitlement (getProStatus), not the billing-disabled dev bypass.
  void getProStatus(userId).then(({ isPro }) =>
    checkAndAward(userId, {
      isFirstSession: user.xp === 0,   // had zero XP before this session
      streak: newStreak,
      level: newLevel,
      totalMinutes: Math.floor(newXp / XP_PER_MINUTE),
      isPro,
      sessionMinutes: durationMinutes,
    }),
  );

  track(userId, 'session_completed', {
    durationMinutes,
    xpEarned: xpGained,
    streak: newStreak,
    level: newLevel,
  });

  return {
    sessionId: _sessionId,
    durationMinutes,
    wasCompleted: true,
    xpEarned: xpGained,
    coinsEarned: xpGained,
    newXp,
    newCoins,
    newLevel,
    newStreak,
    focus: null, // filled in by the caller (stopTimer) with the computed breakdown
  };
}

// ─── Sessions ─────────────────────────────────────────────────

export async function getSessions(userId: string, query: SessionQuery) {
  const { page, limit, from, to, subjectId } = query;
  const offset = (page - 1) * limit;

  let q = supabase
    .from('sessions')
    .select(
      'id, subject_id, started_at, ended_at, duration_minutes, was_completed',
      { count: 'exact' },
    )
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (from) q = q.gte('started_at', from);
  if (to) q = q.lte('started_at', to);
  if (subjectId) q = q.eq('subject_id', subjectId);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  return {
    sessions: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

// ─── Stats ────────────────────────────────────────────────────

export async function getStats(userId: string): Promise<TimerStats> {
  const offset = await getUserOffset(userId);

  // Local day + week windows (UTC instants at the user's local midnight / Monday)
  const todayStart = localDayStart(offset);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const weekStart = localWeekStart(offset);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);

  const [todayRes, weekRes, allTimeRes, userRes, goalRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('duration_minutes, was_completed')
      .eq('user_id', userId)
      .gte('started_at', todayStart.toISOString())
      .lt('started_at', tomorrowStart.toISOString()),

    supabase
      .from('sessions')
      .select('started_at, duration_minutes, was_completed, focus_score')
      .eq('user_id', userId)
      .gte('started_at', weekStart.toISOString())
      .lt('started_at', weekEnd.toISOString()),

    supabase
      .from('sessions')
      .select('duration_minutes, was_completed')
      .eq('user_id', userId),

    supabase
      .from('users')
      .select('xp, level, streak, longest_streak')
      .eq('id', userId)
      .single(),

    supabase
      .from('subjects')
      .select('daily_goal_minutes')
      .eq('user_id', userId)
      .eq('is_active', true),
  ]);

  // Daily goal = sum of active subjects' goals (fallback to 120 min if none set)
  const goalSum = (goalRes.data ?? []).reduce((s, r) => s + (r.daily_goal_minutes ?? 0), 0);
  const goalMinutes = goalSum > 0 ? goalSum : 120;

  // Today
  const todaySessions = todayRes.data ?? [];
  const today = {
    totalMinutes: todaySessions.reduce((s, r) => s + r.duration_minutes, 0),
    goalMinutes,
    sessionsCount: todaySessions.length,
    completedSessions: todaySessions.filter((r) => r.was_completed).length,
  };

  // Week — group by UTC date
  const weekSessions = weekRes.data ?? [];
  const byDate = new Map<string, DailyStat>();

  for (let d = 0; d < 7; d++) {
    const key = localDateKey(new Date(weekStart.getTime() + d * DAY_MS), offset);
    byDate.set(key, { date: key, totalMinutes: 0, sessionsCount: 0, completedSessions: 0 });
  }

  for (const row of weekSessions) {
    const key = localDateKey(row.started_at, offset);
    const entry = byDate.get(key);
    if (entry) {
      entry.totalMinutes += row.duration_minutes;
      entry.sessionsCount += 1;
      if (row.was_completed) entry.completedSessions += 1;
    }
  }

  const dailyBreakdown = [...byDate.values()];
  // Average Focus Score over this week's scored sessions (older sessions are null)
  const scored = weekSessions.filter((r) => r.focus_score != null);
  const avgFocusScore = scored.length
    ? Math.round(scored.reduce((s, r) => s + (r.focus_score as number), 0) / scored.length)
    : null;
  const week = {
    totalMinutes: weekSessions.reduce((s, r) => s + r.duration_minutes, 0),
    sessionsCount: weekSessions.length,
    dailyBreakdown,
    avgFocusScore,
  };

  // All time
  const allRows = allTimeRes.data ?? [];
  const userRow = userRes.data;

  const allTime = {
    totalMinutes: allRows.reduce((s, r) => s + r.duration_minutes, 0),
    totalSessions: allRows.length,
    completedSessions: allRows.filter((r) => r.was_completed).length,
    level: userRow?.level ?? 1,
    xp: userRow?.xp ?? 0,
    streak: userRow?.streak ?? 0,
    longestStreak: userRow?.longest_streak ?? 0,
  };

  return { today, week, allTime };
}

/**
 * Daily focus minutes for the last `days` days (default 30), for a
 * GitHub-contribution-style heat map. Gaps are filled with 0 so the grid is
 * always contiguous. Also returns the current/longest streak for the legend.
 */
export async function getActivityHeatmap(userId: string, days = 30): Promise<HeatmapResponse> {
  const span = Math.min(Math.max(Math.trunc(days), 1), 366);

  const offset = await getUserOffset(userId);
  const todayStart = localDayStart(offset);
  const rangeStart = new Date(todayStart.getTime() - (span - 1) * DAY_MS);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);

  const [sessionsRes, userRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('started_at, duration_minutes')
      .eq('user_id', userId)
      .gte('started_at', rangeStart.toISOString())
      .lt('started_at', tomorrowStart.toISOString()),
    supabase
      .from('users')
      .select('streak, longest_streak')
      .eq('id', userId)
      .single(),
  ]);

  // Seed every day in range with 0, then accumulate
  const byDate = new Map<string, number>();
  for (let d = 0; d < span; d++) {
    const key = localDateKey(new Date(rangeStart.getTime() + d * DAY_MS), offset);
    byDate.set(key, 0);
  }
  for (const row of sessionsRes.data ?? []) {
    const key = localDateKey(row.started_at, offset);
    if (byDate.has(key)) byDate.set(key, (byDate.get(key) ?? 0) + row.duration_minutes);
  }

  const daysList = [...byDate.entries()].map(([date, totalMinutes]) => ({ date, totalMinutes }));

  return {
    days: daysList,
    longestStreak: userRes.data?.longest_streak ?? 0,
    currentStreak: userRes.data?.streak ?? 0,
  };
}

/**
 * Calendar-month stats for a user profile (own or a friend's): every day of
 * the month with total minutes + per-subject breakdown, and month totals per
 * subject. Authorization (self / friendship) is the route's responsibility.
 *
 * Cached in Redis — past months are immutable so they cache for a day; the
 * current month refreshes every 5 minutes.
 */
export async function getMonthlyStats(targetId: string, month: string): Promise<MonthlyStatsResponse> {
  const offset = await getUserOffset(targetId);
  const cacheKey = `monthly:${targetId}:${month}:${offset}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as MonthlyStatsResponse;

  // Month spans the user's LOCAL calendar month (its 1st-midnight → next
  // 1st-midnight, expressed as UTC instants), so day grouping matches the
  // week windows used elsewhere.
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1) - offset * 60_000);
  const end = new Date(Date.UTC(year, mon, 1) - offset * 60_000);
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / DAY_MS);

  const [sessionsRes, userRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('started_at, duration_minutes, subject_id')
      .eq('user_id', targetId)
      .gte('started_at', start.toISOString())
      .lt('started_at', end.toISOString()),
    supabase
      .from('users')
      .select('id, username, level, streak')
      .eq('id', targetId)
      .single(),
  ]);

  if (!userRes.data) {
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
  }
  // A failed sessions query must not get computed (and cached!) as zeros.
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);

  // Seed every day of the month, then accumulate per day + per subject.
  const byDate = new Map<string, { totalMinutes: number; subjects: Record<string, number> }>();
  for (let d = 0; d < daysInMonth; d++) {
    const key = localDateKey(new Date(start.getTime() + d * DAY_MS), offset);
    byDate.set(key, { totalMinutes: 0, subjects: {} });
  }

  const subjectMinutes = new Map<string, number>(); // '' = no subject
  let totalMinutes = 0;
  let sessionsCount = 0;

  for (const row of sessionsRes.data ?? []) {
    const day = byDate.get(localDateKey(row.started_at, offset));
    if (!day) continue;
    const minutes = row.duration_minutes ?? 0;
    if (minutes <= 0) continue;
    const sid = (row.subject_id as string | null) ?? '';

    day.totalMinutes += minutes;
    day.subjects[sid] = (day.subjects[sid] ?? 0) + minutes;
    subjectMinutes.set(sid, (subjectMinutes.get(sid) ?? 0) + minutes);
    totalMinutes += minutes;
    sessionsCount += 1;
  }

  // Resolve subject names/colors — include inactive ones so history stays labelled.
  const subjectIds = [...subjectMinutes.keys()].filter((id) => id !== '');
  const subjectRows = subjectIds.length
    ? (await supabase
        .from('subjects')
        .select('id, name, icon, color')
        .in('id', subjectIds)).data ?? []
    : [];
  const subjectInfo = new Map(subjectRows.map((s) => [s.id as string, s]));

  const subjects: MonthlySubjectTotal[] = [...subjectMinutes.entries()]
    .map(([id, minutes]) => {
      const info = id ? subjectInfo.get(id) : undefined;
      return {
        id: id || null,
        name: (info?.name as string | undefined) ?? null,
        icon: (info?.icon as string | undefined) ?? null,
        color: (info?.color as string | undefined) ?? null,
        totalMinutes: minutes,
      };
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  const days: MonthlyDay[] = [...byDate.entries()].map(([date, d]) => ({
    date,
    totalMinutes: d.totalMinutes,
    ...(d.totalMinutes > 0 ? { subjects: d.subjects } : {}),
  }));

  const activeDays = days.filter((d) => d.totalMinutes > 0).length;
  const bestDayMinutes = days.reduce((max, d) => Math.max(max, d.totalMinutes), 0);

  const result: MonthlyStatsResponse = {
    user: {
      id: userRes.data.id as string,
      username: userRes.data.username as string,
      level: (userRes.data.level as number) ?? 1,
      streak: (userRes.data.streak as number) ?? 0,
    },
    month,
    days,
    subjects,
    summary: { totalMinutes, activeDays, sessionsCount, bestDayMinutes },
  };

  const isCurrentMonth = month === localDateKey(new Date(), offset).slice(0, 7);
  await redis.set(cacheKey, JSON.stringify(result), 'EX', isCurrentMonth ? 300 : 86_400);
  return result;
}

/**
 * Ghost race vs. yesterday: compares today's cumulative focus minutes against
 * yesterday's cumulative minutes up to the same point in the day (UTC), so the
 * user competes with their past self in real time.
 */
export async function getGhost(userId: string): Promise<GhostResponse> {
  const offset = await getUserOffset(userId);
  const now = new Date();
  const todayStart = localDayStart(offset, now);

  const elapsedMs = now.getTime() - todayStart.getTime();
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  const yesterdayCutoff = new Date(yesterdayStart.getTime() + elapsedMs);

  const [todayRes, yResRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('duration_minutes')
      .eq('user_id', userId)
      .gte('started_at', todayStart.toISOString())
      .lt('started_at', now.toISOString()),
    supabase
      .from('sessions')
      .select('duration_minutes')
      .eq('user_id', userId)
      .gte('started_at', yesterdayStart.toISOString())
      .lt('started_at', yesterdayCutoff.toISOString()),
  ]);

  const todayMinutes = (todayRes.data ?? []).reduce((s, r) => s + r.duration_minutes, 0);
  const yesterdayMinutes = (yResRes.data ?? []).reduce((s, r) => s + r.duration_minutes, 0);

  return {
    todayMinutes,
    yesterdayMinutes,
    diff: todayMinutes - yesterdayMinutes,
    hasGhost: yesterdayMinutes > 0,
  };
}

/**
 * Study DNA — a shareable personality snapshot from the user's session
 * history: chronotype (when they study), focus style (how long), dominant
 * subject, and a "superpower" derived from streak/volume/completion.
 */
export async function getStudyDNA(userId: string): Promise<StudyDnaResponse> {
  const [sessionsRes, userRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('started_at, duration_minutes, was_completed, subjects(name)')
      .eq('user_id', userId)
      .limit(5000),
    supabase
      .from('users')
      .select('longest_streak')
      .eq('id', userId)
      .single(),
  ]);

  const sessions = sessionsRes.data ?? [];
  const longestStreak = userRes.data?.longest_streak ?? 0;

  if (sessions.length === 0) {
    return {
      hasData: false,
      totalSessions: 0,
      totalMinutes: 0,
      avgSessionMinutes: 0,
      peakHour: 0,
      chronotype: 'daytime',
      focusStyle: 'steady',
      topSubject: null,
      superpower: 'consistency',
      longestStreak,
    };
  }

  const hourMinutes = new Array<number>(24).fill(0);
  const subjectMinutes = new Map<string, number>();
  let totalMinutes = 0;
  let completed = 0;

  for (const s of sessions) {
    const mins = s.duration_minutes ?? 0;
    totalMinutes += mins;
    if (s.was_completed) completed += 1;
    hourMinutes[new Date(s.started_at).getUTCHours()] += mins;
    const subj = (s.subjects as unknown as { name: string } | null)?.name;
    if (subj) subjectMinutes.set(subj, (subjectMinutes.get(subj) ?? 0) + mins);
  }

  const totalSessions = sessions.length;
  const avgSessionMinutes = Math.round(totalMinutes / totalSessions);

  let peakHour = 0;
  for (let h = 1; h < 24; h++) if (hourMinutes[h] > hourMinutes[peakHour]) peakHour = h;

  const chronotype: StudyDnaResponse['chronotype'] =
    peakHour >= 22 || peakHour <= 4 ? 'night_owl' :
    peakHour >= 5 && peakHour <= 10 ? 'early_bird' :
    'daytime';

  const focusStyle: StudyDnaResponse['focusStyle'] =
    avgSessionMinutes >= 60 ? 'deep' :
    avgSessionMinutes <= 25 ? 'sprinter' :
    'steady';

  let topSubject: string | null = null;
  let topMins = 0;
  for (const [name, mins] of subjectMinutes) {
    if (mins > topMins) { topMins = mins; topSubject = name; }
  }

  const completedRatio = completed / totalSessions;
  const superpower: StudyDnaResponse['superpower'] =
    longestStreak >= 7 ? 'streak' :
    totalSessions >= 50 ? 'volume' :
    completedRatio >= 0.8 ? 'finisher' :
    'consistency';

  return {
    hasData: true,
    totalSessions,
    totalMinutes,
    avgSessionMinutes,
    peakHour,
    chronotype,
    focusStyle,
    topSubject,
    superpower,
    longestStreak,
  };
}

/**
 * Weekly Challenge — replaces the old global Boss Battle.
 *
 * Two mechanics, both scoped to the current UTC week (Monday → next Monday,
 * resets automatically via the week window — no cron):
 *   1. Personal goal: hit `dailyGoalSum × 7` focus minutes this week → claim a
 *      coin reward (once per week, guarded by the `weekly_goal_claims` table).
 *   2. Friend ranking: the caller + accepted friends ranked by this week's
 *      focus minutes, for a bit of friendly competition.
 */
const WEEKLY_REWARD_COINS = 300; // coins for completing the personal weekly goal
const WEEKLY_GOAL_FALLBACK = 120 * 7; // minutes, when the user has no subject goals

/** This week's local Monday 00:00 → next local Monday 00:00 (as UTC instants). */
function currentWeekWindow(offsetMin: number): { weekStart: Date; weekEnd: Date } {
  const weekStart = localWeekStart(offsetMin);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  return { weekStart, weekEnd };
}

/** IDs of the caller's accepted friends (either direction of the friendship). */
async function acceptedFriendIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id, status')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return (data ?? []).map((r) =>
    r.requester_id === userId ? (r.addressee_id as string) : (r.requester_id as string),
  );
}

export async function getWeeklyChallenge(userId: string): Promise<WeeklyChallengeResponse> {
  const offset = await getUserOffset(userId);
  const { weekStart, weekEnd } = currentWeekWindow(offset);

  // Personal weekly goal = sum of active subject daily goals × 7.
  const { data: goalRows } = await supabase
    .from('subjects')
    .select('daily_goal_minutes')
    .eq('user_id', userId)
    .eq('is_active', true);
  const dailyGoalSum = (goalRows ?? []).reduce((s, r) => s + (r.daily_goal_minutes ?? 0), 0);
  const goalMinutes = dailyGoalSum > 0 ? dailyGoalSum * 7 : WEEKLY_GOAL_FALLBACK;

  // Everyone in the ranking: caller + accepted friends.
  const friendIds = await acceptedFriendIds(userId);
  const everyoneIds = [userId, ...friendIds];

  // This week's minutes per user (single query over the whole cohort).
  const { data: sessionRows, error: sErr } = await supabase
    .from('sessions')
    .select('user_id, duration_minutes')
    .in('user_id', everyoneIds)
    .gte('started_at', weekStart.toISOString())
    .lt('started_at', weekEnd.toISOString())
    .limit(50_000);
  if (sErr) throw new Error(sErr.message);

  const minutesByUser = new Map<string, number>();
  for (const id of everyoneIds) minutesByUser.set(id, 0);
  for (const row of sessionRows ?? []) {
    minutesByUser.set(row.user_id, (minutesByUser.get(row.user_id) ?? 0) + row.duration_minutes);
  }

  // Usernames for the ranking rows.
  const { data: userRows } = await supabase
    .from('users')
    .select('id, username')
    .in('id', everyoneIds);
  const usernameById = new Map((userRows ?? []).map((u) => [u.id as string, u.username as string]));

  const friends: WeeklyChallengeRanked[] = everyoneIds
    .map((id) => ({
      userId: id,
      username: usernameById.get(id) ?? '—',
      minutes: minutesByUser.get(id) ?? 0,
      isMe: id === userId,
    }))
    .sort((a, b) => b.minutes - a.minutes);
  const myRank = friends.findIndex((f) => f.isMe) + 1;

  const myMinutes = minutesByUser.get(userId) ?? 0;
  const reached = myMinutes >= goalMinutes;

  // Already claimed this week?
  const weekStartDate = weekStart.toISOString().slice(0, 10);
  const { data: claimRow } = await supabase
    .from('weekly_goal_claims')
    .select('user_id')
    .eq('user_id', userId)
    .eq('week_start', weekStartDate)
    .maybeSingle();

  return {
    weekStartsAt: weekStart.toISOString(),
    weekEndsAt: weekEnd.toISOString(),
    personal: {
      goalMinutes,
      minutes: myMinutes,
      reward: WEEKLY_REWARD_COINS,
      reached,
      claimed: Boolean(claimRow),
    },
    friends,
    myRank,
  };
}

/**
 * Claim this week's personal-goal reward. Idempotent: the unique
 * (user_id, week_start) row guards against double-claims. Throws
 * `GOAL_NOT_REACHED` / `ALREADY_CLAIMED` for the route to map to 4xx.
 */
export async function claimWeeklyReward(userId: string): Promise<WeeklyClaimResult> {
  const offset = await getUserOffset(userId);
  const { weekStart } = currentWeekWindow(offset);
  const weekStartDate = weekStart.toISOString().slice(0, 10);

  // Re-verify the goal server-side (never trust the client).
  const challenge = await getWeeklyChallenge(userId);
  if (!challenge.personal.reached) {
    throw Object.assign(new Error('Weekly goal not reached'), { code: 'GOAL_NOT_REACHED' });
  }

  // Insert the claim row first — the PK makes a double-claim fail here.
  const { error: insErr } = await supabase
    .from('weekly_goal_claims')
    .insert({ user_id: userId, week_start: weekStartDate, coins: WEEKLY_REWARD_COINS });
  if (insErr) {
    // 23505 = unique_violation → already claimed this week
    if ((insErr as { code?: string }).code === '23505') {
      throw Object.assign(new Error('Reward already claimed'), { code: 'ALREADY_CLAIMED' });
    }
    throw new Error(insErr.message);
  }

  // Credit the coins atomically (the claim row is the audit log / dedup guard).
  const { data: newCoins, error: coinErr } = await supabase.rpc('add_coins', {
    p_user_id: userId,
    p_amount: WEEKLY_REWARD_COINS,
  });
  if (coinErr) throw new Error(coinErr.message);

  return {
    claimed: true,
    coinsAwarded: WEEKLY_REWARD_COINS,
    newCoins: (newCoins as number | null) ?? 0,
  };
}

// ─── Subjects ─────────────────────────────────────────────────

export interface SubjectWithStats {
  id: string;
  name: string;
  color: string;
  icon: string;
  totalMinutes: number;
  sessionsCount: number;
}

/** Returns active subjects enriched with total focus time from sessions */
export async function getSubjectStats(userId: string): Promise<SubjectWithStats[]> {
  const [subjectsRes, sessionsRes] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, name, color, icon')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('sessions')
      .select('subject_id, duration_minutes')
      .eq('user_id', userId)
      .not('subject_id', 'is', null),
  ]);

  if (subjectsRes.error) throw new Error(subjectsRes.error.message);

  const minutesMap = new Map<string, number>();
  const countMap   = new Map<string, number>();

  for (const s of sessionsRes.data ?? []) {
    if (!s.subject_id) continue;
    minutesMap.set(s.subject_id, (minutesMap.get(s.subject_id) ?? 0) + s.duration_minutes);
    countMap.set(s.subject_id,   (countMap.get(s.subject_id)   ?? 0) + 1);
  }

  return (subjectsRes.data ?? [])
    .map(s => ({
      id:            s.id,
      name:          s.name,
      color:         s.color,
      icon:          s.icon,
      totalMinutes:  minutesMap.get(s.id) ?? 0,
      sessionsCount: countMap.get(s.id)   ?? 0,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export async function getSubjects(userId: string) {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSubject(userId: string, body: CreateSubjectBody) {
  // Free tier is capped to FREE_SUBJECT_LIMIT active subjects; Pro is unlimited.
  // Skipped entirely when billing is off so dev/Expo Go is unaffected.
  if (billingEnabled && !(await isUserPro(userId))) {
    const { count } = await supabase
      .from('subjects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if ((count ?? 0) >= FREE_SUBJECT_LIMIT) {
      throw Object.assign(
        new Error(`Free plan is limited to ${FREE_SUBJECT_LIMIT} subjects`),
        { code: 'LIMIT_REACHED' },
      );
    }
  }

  const { data, error } = await supabase
    .from('subjects')
    .insert({ ...body, user_id: userId })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateSubject(userId: string, subjectId: string, body: UpdateSubjectBody) {
  const { data, error } = await supabase
    .from('subjects')
    .update(body)
    .eq('id', subjectId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !data) throw Object.assign(new Error('Subject not found'), { code: 'NOT_FOUND' });
  return data;
}

export async function deleteSubject(userId: string, subjectId: string) {
  const { data, error } = await supabase
    .from('subjects')
    .update({ is_active: false })
    .eq('id', subjectId)
    .eq('user_id', userId)
    .select('id')
    .single();

  if (error || !data) throw Object.assign(new Error('Subject not found'), { code: 'NOT_FOUND' });
}
