-- Migration 0002: Widen road_events text columns that overflow for some state feeds.
--
-- route_name VARCHAR(100) is too short for FL/TX road names that include full
-- corridor descriptions (e.g. "SR-528 Beachline Expressway Mainline (All Lanes)").
-- direction VARCHAR(20) is tight for bi-directional descriptions.
-- Changing both to TEXT avoids silent truncation and feed ingest failures.

ALTER TABLE road_events
  ALTER COLUMN route_name TYPE TEXT,
  ALTER COLUMN direction   TYPE TEXT;
