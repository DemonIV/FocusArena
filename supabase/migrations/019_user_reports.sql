-- ============================================================
-- 019_user_reports.sql — abuse reports (App Store Guideline 1.2)
-- ============================================================
-- Apple requires UGC apps to offer a way to report offensive content
-- and to act on those reports. One row = one report filed by one user
-- against another. Reports outlive the reporter's block (and even the
-- reporter's account) so moderation history stays intact, hence the
-- nullable reporter_id with ON DELETE SET NULL.

CREATE TABLE IF NOT EXISTS user_reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Kept in sync with REPORT_REASONS in moderation.schema.ts
  reason           text        NOT NULL CHECK (reason IN (
                     'harassment', 'inappropriate_name', 'spam', 'impersonation', 'other'
                   )),
  -- Free-text detail from the reporter, trimmed to 500 chars by the API
  details          text,
  -- Where the report was filed from: 'friends' | 'search' | 'room' | 'leaderboard'
  context          text,
  status           text        NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  -- Snapshot of the reported username at filing time; survives a rename
  reported_username text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz
);

-- Moderation queue: oldest open reports first
CREATE INDEX IF NOT EXISTS idx_user_reports_open
  ON user_reports(created_at) WHERE status = 'open';

-- "How many times has this account been reported?"
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports(reported_user_id);

-- One reporter may not spam the same target with duplicate open reports.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_reports_open_pair
  ON user_reports(reporter_id, reported_user_id) WHERE status = 'open';

-- Reports are moderation data: no client ever reads them directly, the API
-- writes them with the service role. RLS on with no policy = deny all.
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
