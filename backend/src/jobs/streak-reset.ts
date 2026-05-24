import type Bull from 'bull';
import { supabase } from '../shared';

const CHUNK = 100; // Supabase IN() batch size

export async function processStreakReset(_job: Bull.Job): Promise<{ reset: number }> {
  // UTC day window for "yesterday"
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  // 1. All users with an active streak
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id')
    .gt('streak', 0);

  if (usersErr) throw new Error(`streak-reset: fetch users failed — ${usersErr.message}`);

  const allIds = (users ?? []).map((u) => u.id as string);
  if (allIds.length === 0) return { reset: 0 };

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

  // 3. Users who missed yesterday → reset streak to 0
  const toReset = allIds.filter((id) => !activeSet.has(id));
  if (toReset.length === 0) return { reset: 0 };

  // 4. Batch update in chunks
  for (let i = 0; i < toReset.length; i += CHUNK) {
    const chunk = toReset.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('users')
      .update({ streak: 0 })
      .in('id', chunk);

    if (error) throw new Error(`streak-reset: batch update failed — ${error.message}`);
  }

  console.log(`[streak-reset] Reset ${toReset.length} streak(s) at ${new Date().toISOString()}`);
  return { reset: toReset.length };
}
