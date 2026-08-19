import { z } from 'zod';

/** Kept in sync with the CHECK constraint in 019_user_reports.sql */
export const REPORT_REASONS = [
  'harassment',
  'inappropriate_name',
  'spam',
  'impersonation',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const ReportBodySchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  reason: z.enum(REPORT_REASONS),
  /** Optional free text from the reporter. */
  details: z.string().trim().max(500).optional(),
  /** Which screen the report was filed from — helps triage. */
  context: z.enum(['friends', 'search', 'room', 'leaderboard']).optional(),
});

export type ReportBody = z.infer<typeof ReportBodySchema>;
