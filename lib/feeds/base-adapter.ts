import { pool } from "@/lib/db/index";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import type { IngestResult } from "@/lib/ingestion/weather-ingest";

/**
 * Normalized road event ready for DB upsert.
 * geometry_geojson is required — normalizers return null for features
 * that lack geometry, and those are filtered before the upsert loop.
 */
export interface NormalizedRoadEvent {
  source: string;
  source_event_id: string;
  state: string;
  /** CLOSURE | RESTRICTION | CONSTRUCTION | INCIDENT | WEATHER_CLOSURE | CHAIN_LAW | SPECIAL_EVENT */
  type: string;
  /** CRITICAL | WARNING | ADVISORY | INFO */
  severity: string;
  title: string;
  description: string | null;
  direction: string | null;
  route_name: string | null;
  /** GeoJSON string — always present (null features are filtered before upsert) */
  geometry_geojson: string;
  location_description: string | null;
  started_at: string | null;
  expected_end_at: string | null;
  lane_impact: { vehicle_impact: string; workers_present?: boolean } | null;
  vehicle_restrictions: { type: string; value?: number; unit?: string }[];
  detour_description: string | null;
  source_feed_url: string | null;
  raw: unknown;
}

// Upsert SQL for road_events. Unlike weather_alerts, road_events has an
// updated_at column that we set to NOW() on both insert and conflict update.
// Geometry is always present here (null events filtered before this runs).
const UPSERT_SQL = `
  INSERT INTO road_events (
    source, source_event_id, state, type, severity, title, description,
    direction, route_name, geometry, location_description, started_at,
    expected_end_at, last_updated_at, lane_impact, vehicle_restrictions,
    detour_description, source_feed_url, is_active, raw, updated_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    $8, $9, ST_GeomFromGeoJSON($10), $11, $12,
    $13, NOW(), $14::jsonb, $15::jsonb,
    $16, $17, true, $18::jsonb, NOW()
  )
  ON CONFLICT (source, source_event_id) DO UPDATE SET
    state                = EXCLUDED.state,
    type                 = EXCLUDED.type,
    severity             = EXCLUDED.severity,
    title                = EXCLUDED.title,
    description          = EXCLUDED.description,
    direction            = EXCLUDED.direction,
    route_name           = EXCLUDED.route_name,
    geometry             = EXCLUDED.geometry,
    location_description = EXCLUDED.location_description,
    started_at           = EXCLUDED.started_at,
    expected_end_at      = EXCLUDED.expected_end_at,
    last_updated_at      = NOW(),
    lane_impact          = EXCLUDED.lane_impact,
    vehicle_restrictions = EXCLUDED.vehicle_restrictions,
    detour_description   = EXCLUDED.detour_description,
    source_feed_url      = EXCLUDED.source_feed_url,
    is_active            = true,
    raw                  = EXCLUDED.raw,
    updated_at           = NOW()
`;

function buildUpsertParams(event: NormalizedRoadEvent): unknown[] {
  return [
    event.source,              // $1
    event.source_event_id,     // $2
    event.state,               // $3
    event.type,                // $4
    event.severity,            // $5
    event.title,               // $6
    event.description,         // $7
    event.direction,           // $8
    event.route_name,          // $9
    event.geometry_geojson,    // $10 — GeoJSON string, passed to ST_GeomFromGeoJSON
    event.location_description,// $11
    event.started_at,          // $12
    event.expected_end_at,     // $13
    JSON.stringify(event.lane_impact),          // $14
    JSON.stringify(event.vehicle_restrictions), // $15
    event.detour_description,  // $16
    event.source_feed_url,     // $17
    JSON.stringify(event.raw), // $18
  ];
}

/**
 * Abstract base class for road event feed adapters.
 *
 * Subclasses declare their feed identity and implement fetch() + normalize().
 * The template-method ingest() handles caching, DB upsert, stale deactivation,
 * and feed_status recording — identical for all adapters.
 *
 * Adding a new state feed = create a new file, extend this class, register it.
 * Never modify this file to accommodate a single feed's quirks.
 */
export abstract class BaseFeedAdapter {
  abstract readonly feedName: string;
  abstract readonly feedUrl: string;
  abstract readonly state: string;
  abstract readonly cacheTtlSeconds: number;

  /** HTTP fetch of the raw feed payload. Returns the raw string (usually JSON). */
  abstract fetch(): Promise<string>;

  /**
   * Normalize raw feed payload into an array of road events.
   * Return null for features that lack geometry — they are filtered before upsert.
   */
  abstract normalize(raw: string): (NormalizedRoadEvent | null)[];

  async ingest(): Promise<IngestResult> {
    const start = Date.now();
    const cacheKey = `feed:${this.feedName}:raw`;
    const client = await pool.connect();

    try {
      let rawJson: string | null = await cacheGet(cacheKey).catch(() => null);
      const fetchStart = Date.now();

      if (!rawJson) {
        rawJson = await this.fetch();
        // Non-fatal cache write failure — next request re-fetches from source
        await cacheSet(cacheKey, rawJson, this.cacheTtlSeconds).catch(
          () => undefined
        );
      }

      const fetchMs = Date.now() - fetchStart;

      // Filter out features that lack geometry before upsert
      const events: NormalizedRoadEvent[] = this.normalize(rawJson).filter(
        (e): e is NormalizedRoadEvent => e !== null
      );

      for (const event of events) {
        await client.query(UPSERT_SQL, buildUpsertParams(event));
      }
      const upserted = events.length;

      // Deactivate stale events scoped to this source only — other adapters
      // manage their own events independently.
      const activeIds = events.map((e) => e.source_event_id);
      const deactivateResult = await client.query<{ id: string }>(
        `UPDATE road_events
           SET is_active = false, updated_at = NOW()
         WHERE source = $1
           AND is_active = true
           AND source_event_id != ALL($2::text[])
         RETURNING id`,
        [this.feedName, activeIds]
      );
      const deactivated = deactivateResult.rowCount ?? 0;

      await client.query(
        `INSERT INTO feed_status
           (feed_name, feed_url, status, last_success_at, record_count, avg_fetch_ms, updated_at)
         VALUES ($1, $2, 'healthy', NOW(), $3, $4, NOW())
         ON CONFLICT (feed_name) DO UPDATE SET
           status          = 'healthy',
           feed_url        = EXCLUDED.feed_url,
           last_success_at = NOW(),
           record_count    = EXCLUDED.record_count,
           avg_fetch_ms    = EXCLUDED.avg_fetch_ms,
           updated_at      = NOW()`,
        [this.feedName, this.feedUrl, events.length, Math.round(fetchMs)]
      );

      const totalMs = Date.now() - start;
      process.stdout.write(
        `[ingest] ${this.feedName}: ${events.length} events in ${totalMs}ms (fetch: ${fetchMs}ms, deactivated: ${deactivated})\n`
      );

      return { upserted, deactivated, fetchMs, total: events.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      await client
        .query(
          `INSERT INTO feed_status
             (feed_name, feed_url, status, last_error_at, last_error_message, updated_at)
           VALUES ($1, $2, 'down', NOW(), $3, NOW())
           ON CONFLICT (feed_name) DO UPDATE SET
             status             = 'down',
             last_error_at      = NOW(),
             last_error_message = EXCLUDED.last_error_message,
             updated_at         = NOW()`,
          [this.feedName, this.feedUrl, message]
        )
        .catch(() => undefined);

      throw err;
    } finally {
      client.release();
    }
  }
}
