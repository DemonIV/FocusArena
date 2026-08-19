import { supabase } from '../../shared';
import { captureException, Sentry } from '../../shared/observability';
import type { ReportBody } from './moderation.schema';

/**
 * Files an abuse report (App Store Guideline 1.2).
 *
 * Two things have to be true for Apple: the report is stored, and somebody
 * actually sees it. Storage is the `user_reports` table; visibility is a
 * Sentry event, which is the alerting channel we already watch — a report
 * that only lands in Postgres would sit there unnoticed.
 */
export async function reportUser(reporterId: string, body: ReportBody): Promise<void> {
  const { userId: reportedId, reason, details, context } = body;

  if (reporterId === reportedId) {
    throw Object.assign(new Error('You cannot report yourself'), { code: 'SELF' });
  }

  const { data: target, error: userErr } = await supabase
    .from('users')
    .select('id, username')
    .eq('id', reportedId)
    .maybeSingle();

  if (userErr) throw new Error(userErr.message);
  if (!target) throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });

  const { error } = await supabase.from('user_reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedId,
    reason,
    details: details || null,
    context: context ?? null,
    reported_username: target.username,
  });

  if (error) {
    // The partial unique index rejects a second open report on the same pair.
    // From the reporter's side that is success — the complaint is already in
    // the queue — so it must not surface as a failure.
    if (error.code === '23505') return;
    throw new Error(error.message);
  }

  // Fire-and-forget: a failed alert must never fail the user's report.
  try {
    Sentry.captureMessage(`User report: ${reason}`, {
      level: 'warning',
      tags: { feature: 'moderation', reason },
      extra: { reportedId, reportedUsername: target.username, reporterId, context, details },
    });
  } catch (err) {
    captureException(err, { where: 'reportUser/alert' });
  }
}

/**
 * Number of open reports the caller has filed against a user — lets the
 * client show "already reported" instead of offering the action twice.
 */
export async function hasOpenReport(reporterId: string, reportedId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_reports')
    .select('id')
    .eq('reporter_id', reporterId)
    .eq('reported_user_id', reportedId)
    .eq('status', 'open')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}
