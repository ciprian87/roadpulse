-- Enable PostGIS extension (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- road_events
-- ============================================================
CREATE TABLE IF NOT EXISTS road_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source               VARCHAR(50)  NOT NULL,
  source_event_id      VARCHAR(255) NOT NULL,
  state                CHAR(2)      NOT NULL,
  type                 VARCHAR(50)  NOT NULL,  -- CLOSURE | RESTRICTION | CONSTRUCTION | INCIDENT | WEATHER_CLOSURE | CHAIN_LAW | SPECIAL_EVENT
  severity             VARCHAR(20)  NOT NULL,  -- CRITICAL | WARNING | ADVISORY | INFO
  title                TEXT         NOT NULL,
  description          TEXT,
  direction            VARCHAR(20),
  route_name           VARCHAR(100),
  geometry             GEOMETRY(Geometry, 4326) NOT NULL,
  location_description TEXT,
  started_at           TIMESTAMPTZ,
  expected_end_at      TIMESTAMPTZ,
  last_updated_at      TIMESTAMPTZ,
  lane_impact          JSONB,
  vehicle_restrictions JSONB        NOT NULL DEFAULT '[]',
  detour_description   TEXT,
  source_feed_url      TEXT,
  is_active            BOOLEAN      NOT NULL DEFAULT true,
  raw                  JSONB,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_event_id)
);

CREATE INDEX IF NOT EXISTS road_events_geometry_gist_idx ON road_events USING GIST (geometry);
CREATE INDEX IF NOT EXISTS road_events_state_idx         ON road_events (state);
CREATE INDEX IF NOT EXISTS road_events_is_active_idx     ON road_events (is_active);
CREATE INDEX IF NOT EXISTS road_events_type_idx          ON road_events (type);
CREATE INDEX IF NOT EXISTS road_events_severity_idx      ON road_events (severity);

-- ============================================================
-- weather_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS weather_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nws_id          VARCHAR(255) NOT NULL UNIQUE,
  event           VARCHAR(100) NOT NULL,
  severity        VARCHAR(20)  NOT NULL,
  urgency         VARCHAR(20),
  certainty       VARCHAR(20),
  headline        TEXT,
  description     TEXT,
  instruction     TEXT,
  area_description TEXT,
  affected_zones  TEXT[],
  geometry        GEOMETRY(Geometry, 4326),
  onset           TIMESTAMPTZ,
  expires         TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ,
  sender_name     VARCHAR(255),
  wind_speed      VARCHAR(50),
  snow_amount     VARCHAR(50),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  raw             JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS weather_alerts_geometry_gist_idx ON weather_alerts USING GIST (geometry) WHERE geometry IS NOT NULL;
CREATE INDEX IF NOT EXISTS weather_alerts_is_active_idx     ON weather_alerts (is_active);
CREATE INDEX IF NOT EXISTS weather_alerts_event_idx         ON weather_alerts (event);

-- ============================================================
-- parking_facilities
-- ============================================================
CREATE TABLE IF NOT EXISTS parking_facilities (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source             VARCHAR(50)  NOT NULL,
  source_facility_id VARCHAR(255) NOT NULL,
  name               VARCHAR(255) NOT NULL,
  state              CHAR(2)      NOT NULL,
  highway            VARCHAR(100),
  direction          VARCHAR(20),
  location           GEOMETRY(Point, 4326) NOT NULL,
  total_spaces       INTEGER,
  available_spaces   INTEGER,
  trend              VARCHAR(20),  -- FILLING | CLEARING | STABLE
  amenities          JSONB        NOT NULL DEFAULT '[]',
  last_updated_at    TIMESTAMPTZ,
  is_active          BOOLEAN      NOT NULL DEFAULT true,
  UNIQUE (source, source_facility_id)
);

CREATE INDEX IF NOT EXISTS parking_facilities_location_gist_idx ON parking_facilities USING GIST (location);

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  name          VARCHAR(255),
  role          VARCHAR(20)  NOT NULL DEFAULT 'driver',
  preferences   JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- saved_routes
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_routes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 VARCHAR(255) NOT NULL,
  origin_address       TEXT         NOT NULL,
  origin_lat           DOUBLE PRECISION NOT NULL,
  origin_lng           DOUBLE PRECISION NOT NULL,
  destination_address  TEXT         NOT NULL,
  destination_lat      DOUBLE PRECISION NOT NULL,
  destination_lng      DOUBLE PRECISION NOT NULL,
  route_geometry       GEOMETRY(LineString, 4326),
  corridor_buffer      GEOMETRY(Polygon, 4326),
  is_favorite          BOOLEAN      NOT NULL DEFAULT false,
  last_checked_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_routes_user_id_idx             ON saved_routes (user_id);
CREATE INDEX IF NOT EXISTS saved_routes_corridor_buffer_gist_idx ON saved_routes USING GIST (corridor_buffer) WHERE corridor_buffer IS NOT NULL;

-- ============================================================
-- community_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS community_reports (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES users(id) ON DELETE SET NULL,
  type                 VARCHAR(50)  NOT NULL,  -- ROAD_HAZARD | CLOSURE_UPDATE | WEATHER_CONDITION | WAIT_TIME | PARKING_FULL | OTHER
  title                VARCHAR(255) NOT NULL,
  description          TEXT,
  location             GEOMETRY(Point, 4326) NOT NULL,
  location_description VARCHAR(255),
  route_name           VARCHAR(100),
  state                CHAR(2),
  severity             VARCHAR(20)  NOT NULL DEFAULT 'INFO',
  photo_url            TEXT,
  upvotes              INTEGER      NOT NULL DEFAULT 0,
  downvotes            INTEGER      NOT NULL DEFAULT 0,
  is_active            BOOLEAN      NOT NULL DEFAULT true,
  expires_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_reports_location_gist_idx ON community_reports USING GIST (location);
CREATE INDEX IF NOT EXISTS community_reports_is_active_idx     ON community_reports (is_active);

-- ============================================================
-- feed_status
-- ============================================================
CREATE TABLE IF NOT EXISTS feed_status (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_name           VARCHAR(100) NOT NULL UNIQUE,
  state               CHAR(2),
  feed_url            TEXT,
  last_success_at     TIMESTAMPTZ,
  last_error_at       TIMESTAMPTZ,
  last_error_message  TEXT,
  record_count        INTEGER      DEFAULT 0,
  avg_fetch_ms        INTEGER,
  status              VARCHAR(20)  NOT NULL DEFAULT 'unknown',  -- healthy | degraded | down | unknown
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
