import type Bull from 'bull';
import { notifyWinback } from '../modules/notifications';

/**
 * Win-back nudge: users whose last completed session was exactly 3 or 7 days
 * ago get one localized "come back" push (pet-flavored if they own a pet).
 * Runs daily in the late afternoon UTC — evening for EU/TR users.
 */
export async function processWinback(_job: Bull.Job): Promise<{ sent: number }> {
  const sent = await notifyWinback();
  console.log(`[winback] Queued ${sent} win-back push(es) at ${new Date().toISOString()}`);
  return { sent };
}
