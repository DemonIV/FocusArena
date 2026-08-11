import type Bull from 'bull';
import { supabase, redis } from '../shared';

/** Sessions older than this are considered abandoned */
const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1_000; // 4 hours

/**
 * Hard ceiling for rows created before migration 018 (no `target_minutes`).
 * Mirrors StartTimerSchema's `.max(180)` — no session can legitimately be longer.
 */
const MAX_SESSION_MINUTES = 180;

export async function processSessionCleanup(_job: Bull.Job): Promise<{ closed: number }> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  // Find sessions still open past the threshold
  const { data: stale, error } = await supabase
    .from('sessions')
    .select('id, user_id, started_at, target_minutes')
    .is('ended_at', null)
    .lt('started_at', cutoff.toISOString());

  if (error) throw new Error(`session-cleanup: query failed — ${error.message}`);
  if (!stale || stale.length === 0) return { closed: 0 };

  const now = new Date().toISOString();

  // Close each stale session
  await Promise.all(
    stale.map(async (session) => {
      const startedAt = new Date(session.started_at as string).getTime();
      const elapsedMinutes = Math.floor((Date.now() - startedAt) / 60_000);

      // Never bank more than the session was set for. Without this a forgotten
      // timer records raw wall-clock — and because the Fly machine auto-stops
      // when idle, this job can miss its 4-hour window entirely and only run a
      // day later, which is how a 25-minute timer once recorded 35 hours.
      const cap = session.target_minutes ?? MAX_SESSION_MINUTES;
      const durationMinutes = Math.min(elapsedMinutes, cap);

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
