import { pool } from "@/lib/db/index";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { fetchRawAlerts, parseAlerts, type NormalizedAlert } from "@/lib/weather/nws";
import { fetchZoneGeometryMap, mergeToMultiPolygon } from "@/lib/weather/zone-resolver";
import { logIngestionRun } from "@/lib/admin/ingestion-repository";
import { logUsageEvent } from "@/lib/admin/usage-repository";

const CACHE_KEY = "nws:alerts:raw";
const CACHE_TTL_SECONDS = 120; // 2 minutes — matches NWS rate limit guidance
const FEED_NAME = "nws-alerts";
const NWS_ALERTS_URL = "https://api.weather.gov/alerts/active";

// SQL for upsert: use ST_GeomFromGeoJSON for geometry, fall back to NULL when absent.
// $11 is the geometry GeoJSON string; CASE handles the null-geometry case without
// splitting into two query variants.
const UPSERT_SQL = `
  INSERT INTO weather_alerts (
    nws_id, event, severity, urgency, certainty,
    headline, description, instruction, area_description,
    affected_zones, geometry, onset, expires, last_updated_at,
    sender_name, wind_speed, snow_amount, is_active, raw
  ) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9,
    $10::text[],
    CASE WHEN $11::text IS NULL THEN NULL ELSE ST_GeomFromGeoJSON($11) END,
    $12, $13, NOW(),
    $14, $15, $16, true, $17::jsonb
  )
  ON CONFLICT (nws_id) DO UPDATE SET
    event            = EXCLUDED.event,
    severity         = EXCLUDED.severity,
    urgency          = EXCLUDED.urgency,
    certainty        = EXCLUDED.certainty,
    headline         = EXCLUDED.headline,
    description      = EXCLUDED.description,
    instruction      = EXCLUDED.instruction,
    area_description = EXCLUDED.area_description,
    affected_zones   = EXCLUDED.affected_zones,
    geometry         = EXCLUDED.geometry,
    onset            = EXCLUDED.onset,
    expires          = EXCLUDED.expires,
    last_updated_at  = NOW(),
    sender_name      = EXCLUDED.sender_name,
    wind_speed       = EXCLUDED.wind_speed,
    snow_amount      = EXCLUDED.snow_amount,
    is_active        = true,
    raw              = EXCLUDED.raw
`;

function buildUpsertParams(alert: NormalizedAlert): unknown[] {
  return [
    alert.nws_id, // $1
    alert.event, // $2
    alert.severity, // $3
    alert.urgency, // $4
    alert.certainty, // $5
    alert.headline, // $6
    alert.description, // $7
    alert.instruction, // $8
    alert.area_description, // $9
    alert.affected_zones, // $10 — pg driver sends JS array as TEXT[]
    alert.geometry_geojson, // $11 — JSON string or null
    alert.onset, // $12
    alert.expires, // $13
    alert.sender_name, // $14
    alert.wind_speed, // $15
    alert.snow_amount, // $16
    JSON.stringify(alert.raw), // $17
  ];
}

export interface IngestResult {
  upserted: number;
  deactivated: number;
  purged: number;
  fetchMs: number;
  total: number;
}

export async function ingestWeatherAlerts(): Promise<IngestResult> {
  const start = Date.now();
  const client = await pool.connect();

  try {
    // Check Redis first. Cache the raw NWS JSON string (not the normalized form)
    // so Date serialization round-trips stay clean on deserialization.
    let rawJson: string | null = await cacheGet(CACHE_KEY).catch(() => null);
    const fetchStart = Date.now();

    if (!rawJson) {
      rawJson = await fetchRawAlerts();
      // Non-fatal: a cache write failure just means the next request also hits NWS
      await cacheSet(CACHE_KEY, rawJson, CACHE_TTL_SECONDS).catch(
        () => undefined
      );
    }

    const fetchMs = Date.now() - fetchStart;
    const alerts = parseAlerts(rawJson);

    // Enrich alerts that lack direct NWS polygon geometry by resolving their
    // affectedZones URLs. Zone geometries are cached 24h in Redis — only slow
    // on the very first ingestion run; subsequent runs are fully served from cache.
    const zoneUrls: string[] = [];
    for (const alert of alerts) {
      if (!alert.geometry_geojson) {
        for (const url of alert.raw.properties.affectedZones) {
          zoneUrls.push(url);
        }
      }
    }

    if (zoneUrls.length > 0) {
      const zoneGeomMap = await fetchZoneGeometryMap(zoneUrls);
      for (const alert of alerts) {
        if (!alert.geometry_geojson) {
          const zoneGeoms = alert.raw.properties.affectedZones.map((url) =>
            zoneGeomMap.get(url)
          );
          const merged = mergeToMultiPolygon(zoneGeoms);
          if (merged) {
            alert.geometry_geojson = JSON.stringify(merged);
          }
        }
      }
    }

    // Upsert all road-relevant active alerts
    for (const alert of alerts) {
      await client.query(UPSERT_SQL, buildUpsertParams(alert));
    }
    const upserted = alerts.length;

    // Mark alerts as inactive when either:
    //   (a) they are no longer present in the latest NWS feed, or
    //   (b) their expires timestamp has passed (belt-and-suspenders — NWS sometimes
    //       keeps stale alerts in the active feed past their expiry time).
    // An empty activeNwsIds array deactivates everything, which is correct when
    // NWS returns no road-relevant alerts for the current conditions.
    const activeNwsIds = alerts.map((a) => a.nws_id);
    const deactivateResult = await client.query<{ id: string }>(
      `UPDATE weather_alerts
         SET is_active = false
       WHERE is_active = true
         AND (
           nws_id != ALL($1::text[])
           OR (expires IS NOT NULL AND expires < NOW())
         )
       RETURNING id`,
      [activeNwsIds]
    );
    const deactivated = deactivateResult.rowCount ?? 0;

    // Purge records that have been expired for more than 24 hours.
    // Keeps the table lean while preserving a short window for debugging/auditing.
    const purgeResult = await client.query<{ id: string }>(
      `DELETE FROM weather_alerts
       WHERE expires IS NOT NULL
         AND expires < NOW() - INTERVAL '24 hours'
       RETURNING id`
    );
    const purged = purgeResult.rowCount ?? 0;

    // Record success in feed_status so the UI can show "last updated X minutes ago"
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
      [FEED_NAME, NWS_ALERTS_URL, alerts.length, Math.round(fetchMs)]
    );

    const totalMs = Date.now() - start;
    process.stdout.write(
      `[ingest] nws-alerts: ${alerts.length} alerts in ${totalMs}ms (fetch: ${fetchMs}ms, deactivated: ${deactivated}, purged: ${purged})\n`
    );

    await logIngestionRun({
      feed_name: FEED_NAME,
      status: "success",
      duration_ms: totalMs,
      records_inserted: upserted,
      records_deactivated: deactivated,
    }).catch(() => undefined);

    await logUsageEvent("FEED_INGEST", {
      feedName: FEED_NAME,
      records: alerts.length,
      deactivated,
      purged,
      duration_ms: totalMs,
    }).catch(() => undefined);

    return { upserted, deactivated, purged, fetchMs, total: alerts.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Record failure in feed_status — silent feed death is the worst failure mode
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
        [FEED_NAME, NWS_ALERTS_URL, message]
      )
      .catch(() => undefined); // Don't mask the original error

    const errorTotalMs = Date.now() - start;
    await logIngestionRun({
      feed_name: FEED_NAME,
      status: "failed",
      duration_ms: errorTotalMs,
      error_message: message,
    }).catch(() => undefined);

    await logUsageEvent("FEED_ERROR", {
      feedName: FEED_NAME,
      error: message,
      duration_ms: errorTotalMs,
    }).catch(() => undefined);

    throw err;
  } finally {
    client.release();
  }
}
