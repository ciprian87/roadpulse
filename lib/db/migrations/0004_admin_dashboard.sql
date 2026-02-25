-- Admin dashboard migration: usage_events, ingestion_logs, app_settings tables
-- plus new columns on existing tables for admin functionality.

-- Usage event audit log
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);

-- Per-ingestion run logs (one row per feed per run)
CREATE TABLE IF NOT EXISTS ingestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_name VARCHAR(100) NOT NULL,
  -- success | partial | failed
  status VARCHAR(20) NOT NULL,
  duration_ms INT,
  records_inserted INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_deactivated INT DEFAULT 0,
  records_errored INT DEFAULT 0,
  error_message TEXT,
  data_hash VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_feed ON ingestion_logs(feed_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created ON ingestion_logs(created_at);

-- Key-value admin settings
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- community_reports: moderation columns
ALTER TABLE community_reports
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

-- users: activity tracking
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- feed_status: scheduler control
ALTER TABLE feed_status
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS refresh_interval_minutes INT DEFAULT 5;

-- Seed default app_settings
INSERT INTO app_settings (key, value) VALUES
  ('nws_cache_ttl_seconds', '120'),
  ('route_cache_ttl_seconds', '300'),
  ('corridor_buffer_miles', '10'),
  ('community_report_ttl_hours', '24'),
  ('community_report_vote_threshold', '-3'),
  ('community_report_rate_limit_per_hour', '10'),
  ('max_api_limit', '500'),
  ('feed_default_interval_minutes', '5')
ON CONFLICT (key) DO NOTHING;
