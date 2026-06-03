import { supabase, redis } from '../../shared';
import { invalidateCache } from '../leaderboard';
import { checkAndAward } from '../achievements';
import { addStudyMinutesToRooms } from '../rooms/rooms.service';
import { getSocketServer } from '../../websocket';
import type {
  ActiveTimerState,
  TimerStatusResponse,
  StopTimerResult,
  TimerStats,
  DailyStat,
  CreateSubjectBody,
  UpdateSubjectBody,
  SessionQuery,
} from './timer.schema';

// ─── Constants ────────────────────────────────────────────────

const TIMER_TTL = 60 * 60 * 4; // 4 hours max session in Redis
const XP_PER_MINUTE = 10;
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

export async function stopTimer(userId: string): Promise<StopTimerResult> {
  const state = await readState(userId);
  if (!state) throw Object.assign(new Error('No active session'), { code: 'NO_TIMER' });

  const elapsedMs = computeElapsedMs(state);
  const durationMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const wasCompleted = elapsedMs >= state.duration * 60_000 * COMPLETION_THRESHOLD;

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
    })
    .eq('id', state.sessionId);

  if (error) {
    // Log but don't re-throw — Redis is already cleared, no point blocking the user
    console.error(`stopTimer: DB update failed (session=${state.sessionId}): ${error.message}`);
    return { sessionId: state.sessionId, durationMinutes, wasCompleted: false, xpEarned: 0, newXp: 0, newLevel: 1, newStreak: 0 };
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
    return { sessionId: state.sessionId, durationMinutes, wasCompleted, xpEarned: 0, newXp: 0, newLevel: 1, newStreak: 0 };
  }

  const result = await awardXpAndStreak(userId, state.sessionId, durationMinutes);

  // Bust leaderboard caches for all time-windowed periods (fire-and-forget)
  void Promise.allSettled([
    invalidateCache('daily'),
    invalidateCache('weekly'),
    invalidateCache('monthly'),
    invalidateCache('alltime'),
  ]);

  return result;
}

export async function getTimerStatus(userId: string): Promise<TimerStatusResponse> {
  const state = await readState(userId);
  if (!state) return { active: false };

  const elapsedMs = computeElapsedMs(state);
  const remainingMs = Math.max(0, state.duration * 60_000 - elapsedMs);

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
    .select('xp, level, streak, longest_streak')
    .eq('id', userId)
    .single();

  if (userErr || !user) throw new Error('User not found');

  const newXp = user.xp + xpGained;
  const newLevel = computeLevel(newXp);

  // ── Streak logic ──────────────────────────────────────────
  const todayUtcStart = new Date();
  todayUtcStart.setUTCHours(0, 0, 0, 0);
  const tomorrowUtcStart = new Date(todayUtcStart.getTime() + 86_400_000);
  const yesterdayUtcStart = new Date(todayUtcStart.getTime() - 86_400_000);

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
      streak: newStreak,
      longest_streak: newLongestStreak,
    })
    .eq('id', userId);

  // Check & award achievements (fire-and-forget)
  void checkAndAward(userId, {
    isFirstSession: user.xp === 0,   // had zero XP before this session
    streak: newStreak,
    level: newLevel,
    totalMinutes: Math.floor(newXp / XP_PER_MINUTE),
  });

  return {
    sessionId: _sessionId,
    durationMinutes,
    wasCompleted: true,
    xpEarned: xpGained,
    newXp,
    newLevel,
    newStreak,
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
  const now = new Date();

  // Today
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

  // This week (Mon → Sun)
  const dayOfWeek = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const weekStart = new Date(todayStart.getTime() - daysSinceMonday * 86_400_000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

  const [todayRes, weekRes, allTimeRes, userRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('duration_minutes, was_completed')
      .eq('user_id', userId)
      .gte('started_at', todayStart.toISOString())
      .lt('started_at', tomorrowStart.toISOString()),

    supabase
      .from('sessions')
      .select('started_at, duration_minutes, was_completed')
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
  ]);

  // Today
  const todaySessions = todayRes.data ?? [];
  const today = {
    totalMinutes: todaySessions.reduce((s, r) => s + r.duration_minutes, 0),
    sessionsCount: todaySessions.length,
    completedSessions: todaySessions.filter((r) => r.was_completed).length,
  };

  // Week — group by UTC date
  const weekSessions = weekRes.data ?? [];
  const byDate = new Map<string, DailyStat>();

  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStart.getTime() + d * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    byDate.set(key, { date: key, totalMinutes: 0, sessionsCount: 0, completedSessions: 0 });
  }

  for (const row of weekSessions) {
    const key = new Date(row.started_at).toISOString().slice(0, 10);
    const entry = byDate.get(key);
    if (entry) {
      entry.totalMinutes += row.duration_minutes;
      entry.sessionsCount += 1;
      if (row.was_completed) entry.completedSessions += 1;
    }
  }

  const dailyBreakdown = [...byDate.values()];
  const week = {
    totalMinutes: weekSessions.reduce((s, r) => s + r.duration_minutes, 0),
    sessionsCount: weekSessions.length,
    dailyBreakdown,
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
