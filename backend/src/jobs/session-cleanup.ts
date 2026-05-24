import type Bull from 'bull';
import { supabase, redis } from '../shared';

/** Sessions older than this are considered abandoned */
const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1_000; // 4 hours

export async function processSessionCleanup(_job: Bull.Job): Promise<{ closed: number }> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  // Find sessions still open past the threshold
  const { data: stale, error } = await supabase
    .from('sessions')
    .select('id, user_id, started_at')
    .is('ended_at', null)
    .lt('started_at', cutoff.toISOString());

  if (error) throw new Error(`session-cleanup: query failed — ${error.message}`);
  if (!stale || stale.length === 0) return { closed: 0 };

  const now = new Date().toISOString();

  // Close each stale session
  await Promise.all(
    stale.map(async (session) => {
      const startedAt = new Date(session.started_at as string).getTime();
      const durationMinutes = Math.floor((Date.now() - startedAt) / 60_000);

      const { error: updateErr } = await supabase
        .from('sessions')
        .update({
          ended_at: now,
          duration_minutes: durationMinutes,
          was_completed: false, // abandoned — no XP awarded
        })
        .eq('id', session.id)
        .is('ended_at', null); // guard against race with concurrent close

      if (updateErr) {
        console.error(`[session-cleanup] Failed to close session ${session.id}:`, updateErr.message);
        return;
      }

      // Remove the Redis timer key so the user can start a new session
      await redis.del(`timer:${session.user_id}`);
    }),
  );

  console.log(`[session-cleanup] Closed ${stale.length} stale session(s) at ${now}`);
  return { closed: stale.length };
}
