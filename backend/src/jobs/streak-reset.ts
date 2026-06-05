import type Bull from 'bull';
import { supabase } from '../shared';

const CHUNK = 100; // Supabase IN() batch size

interface StreakUser {
  id: string;
  is_pro: boolean | null;
  pro_expires_at: string | null;
  streak_freezes: number | null;
}

/** A Pro user (not expired) who still has a freeze to spend. */
function canFreeze(u: StreakUser, now: number): boolean {
  const proActive =
    Boolean(u.is_pro) && (!u.pro_expires_at || new Date(u.pro_expires_at).getTime() > now);
  return proActive && (u.streak_freezes ?? 0) > 0;
}

export async function processStreakReset(_job: Bull.Job): Promise<{ reset: number; frozen: number }> {
  // UTC day window for "yesterday"
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  // 1. All users with an active streak
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, is_pro, pro_expires_at, streak_freezes')
    .gt('streak', 0);

  if (usersErr) throw new Error(`streak-reset: fetch users failed — ${usersErr.message}`);

  const all = (users ?? []) as StreakUser[];
  if (all.length === 0) return { reset: 0, frozen: 0 };

  const allIds = all.map((u) => u.id);

  // 2. Users who DID complete a session yesterday (exempt from reset)
  const { data: active, error: sessErr } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('was_completed', true)
    .gte('started_at', yesterdayStart.toISOString())
    .lt('started_at', todayStart.toISOString())
    .in('user_id', allIds);

  if (sessErr) throw new Error(`streak-reset: fetch sessions failed — ${sessErr.message}`);

  const activeSet = new Set((active ?? []).map((s) => s.user_id as string));

  // 3. Users who missed yesterday → would lose their streak
  const now = Date.now();
  const missed = all.filter((u) => !activeSet.has(u.id));

  // 3a. Pro users with a freeze: spend one, keep the streak
  const frozen = missed.filter((u) => canFreeze(u, now));
  // 3b. Everyone else who missed: reset to 0
  const toReset = missed.filter((u) => !canFreeze(u, now)).map((u) => u.id);

  // 4. Consume one freeze per protected user (small set — Pro who missed a day)
  for (const u of frozen) {
    const { error } = await supabase
      .from('users')
      .update({ streak_freezes: Math.max(0, (u.streak_freezes ?? 1) - 1) })
      .eq('id', u.id);
    if (error) throw new Error(`streak-reset: freeze update failed — ${error.message}`);
  }

  // 5. Batch-reset the rest in chunks
  for (let i = 0; i < toReset.length; i += CHUNK) {
    const chunk = toReset.slice(i, i + CHUNK);
    const { error } = await supabase.from('users').update({ streak: 0 }).in('id', chunk);
    if (error) throw new Error(`streak-reset: batch update failed — ${error.message}`);
  }

  console.log(
    `[streak-reset] Reset ${toReset.length}, froze ${frozen.length} at ${new Date().toISOString()}`,
  );
  return { reset: toReset.length, frozen: frozen.length };
}
