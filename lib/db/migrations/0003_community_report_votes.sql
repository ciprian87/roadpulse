-- Track which user voted on which report.
-- upvotes/downvotes on community_reports are denormalized counters kept in sync
-- transactionally so reads are O(1) — avoids COUNT(*) on the votes table.
CREATE TABLE IF NOT EXISTS community_report_votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID        NOT NULL REFERENCES community_reports(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote       VARCHAR(4)  NOT NULL CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_report_votes_report_id_idx ON community_report_votes (report_id);
CREATE INDEX IF NOT EXISTS community_report_votes_user_id_idx   ON community_report_votes (user_id);
