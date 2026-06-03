import type Bull from 'bull';
import { notifyStreakDanger } from '../modules/notifications';

/**
 * Evening nudge: remind users whose streak is still alive but who haven't
 * studied yet today, before the nightly streak-reset wipes it. Runs well
 * before midnight UTC so there is still time to act.
 */
export async function processStreakReminder(_job: Bull.Job): Promise<{ sent: number }> {
  const sent = await notifyStreakDanger();
  console.log(`[streak-reminder] Queued ${sent} reminder(s) at ${new Date().toISOString()}`);
  return { sent };
}
