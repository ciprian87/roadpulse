import { pool } from "@/lib/db";

export interface OverviewStats {
  activeRoadEvents: number;
  activeWeatherAlerts: number;
  registeredUsers: number;
  routeChecksToday: number;
  pendingReports: number;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface StateEventCount {
  state: string;
  count: number;
}

export interface RecentActivityRow {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

export interface HourlyPoint {
  hour: number;
  count: number;
}

export interface CorridorRow {
  origin: string;
  destination: string;
  count: number;
}

export interface FeatureUsageRow {
  feature: string;
  count: number;
}

export async function logUsageEvent(
  eventType: string,
  metadata: Record<string, unknown> = {},
  userId?: string | null
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO usage_events (event_type, metadata, user_id) VALUES ($1, $2::jsonb, $3)`,
      [eventType, JSON.stringify(metadata), userId ?? null]
    );
  } finally {
    client.release();
  }
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const client = await pool.connect();
  try {
    const [roadRes, weatherRes, usersRes, routeRes, reportsRes] = await Promise.all([
      client.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM road_events WHERE is_active = true"
      ),
      client.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM weather_alerts WHERE is_active = true"
      ),
      client.query<{ count: string }>("SELECT COUNT(*) AS count FROM users"),
      client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM usage_events
         WHERE event_type = 'ROUTE_CHECK'
           AND created_at >= NOW() - INTERVAL '24 hours'`
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM community_reports
         WHERE is_active = true AND moderation_status = 'pending'`
      ),
    ]);

    return {
      activeRoadEvents: parseInt(roadRes.rows[0].count, 10),
      activeWeatherAlerts: parseInt(weatherRes.rows[0].count, 10),
      registeredUsers: parseInt(usersRes.rows[0].count, 10),
      routeChecksToday: parseInt(routeRes.rows[0].count, 10),
      pendingReports: parseInt(reportsRes.rows[0].count, 10),
    };
  } finally {
    client.release();
  }
}

export async function getRouteCheckTimeSeries(days: number): Promise<TimeSeriesPoint[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ date: string; count: string }>(
      `SELECT
         DATE_TRUNC('day', created_at)::date::text AS date,
         COUNT(*) AS count
       FROM usage_events
       WHERE event_type = 'ROUTE_CHECK'
         AND created_at >= NOW() - ($1 * INTERVAL '1 day')
       GROUP BY 1
       ORDER BY 1`,
      [days]
    );
    return result.rows.map((r) => ({ date: r.date, count: parseInt(r.count, 10) }));
  } finally {
    client.release();
  }
}

export async function getEventsByState(): Promise<StateEventCount[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ state: string; count: string }>(
      `SELECT state, COUNT(*) AS count
       FROM road_events
       WHERE is_active = true
       GROUP BY state
       ORDER BY count DESC
       LIMIT 10`
    );
    return result.rows.map((r) => ({ state: r.state, count: parseInt(r.count, 10) }));
  } finally {
    client.release();
  }
}

export async function getRecentActivity(limit = 20): Promise<RecentActivityRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ id: string; event_type: string; metadata: Record<string, unknown>; created_at: Date }>(
      `SELECT id, event_type, metadata, created_at
       FROM usage_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((r) => ({
      id: r.id,
      type: r.event_type,
      // Build human-readable description from event type and metadata
      description: buildActivityDescription(r.event_type, r.metadata ?? {}),
      timestamp: r.created_at.toISOString(),
    }));
  } finally {
    client.release();
  }
}

function buildActivityDescription(type: string, meta: Record<string, unknown>): string {
  switch (type) {
    case "ROUTE_CHECK":
      return `Route check: ${meta.origin ?? "??"} → ${meta.destination ?? "??"}`;
    case "USER_REGISTER":
      return `New user registered (ID: ${String(meta.userId ?? "unknown").slice(0, 8)})`;
    case "USER_LOGIN":
      return `User logged in: ${meta.email ?? "unknown"}`;
    case "REPORT_SUBMIT":
      return `Report submitted: ${meta.reportType ?? "unknown"} in ${meta.state ?? "??"}`;
    case "FEED_INGEST":
      return `Feed ingested: ${meta.feedName ?? "unknown"} (${meta.records ?? 0} records)`;
    case "FEED_ERROR":
      return `Feed error: ${meta.feedName ?? "unknown"} — ${meta.error ?? "unknown error"}`;
    case "MODERATION":
      return `Moderation action on report ${String(meta.reportId ?? "??").slice(0, 8)}`;
    default:
      return type.replace(/_/g, " ").toLowerCase();
  }
}

export async function getRouteCheckHourly(): Promise<HourlyPoint[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ hour: string; count: string }>(
      `SELECT
         EXTRACT(HOUR FROM created_at)::int AS hour,
         COUNT(*) AS count
       FROM usage_events
       WHERE event_type = 'ROUTE_CHECK'
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY 1
       ORDER BY 1`
    );
    return result.rows.map((r) => ({ hour: parseInt(r.hour, 10), count: parseInt(r.count, 10) }));
  } finally {
    client.release();
  }
}

export async function getTopCorridors(limit = 20): Promise<CorridorRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ origin: string; destination: string; count: string }>(
      `SELECT
         metadata->>'origin' AS origin,
         metadata->>'destination' AS destination,
         COUNT(*) AS count
       FROM usage_events
       WHERE event_type = 'ROUTE_CHECK'
         AND metadata->>'origin' IS NOT NULL
         AND metadata->>'destination' IS NOT NULL
       GROUP BY 1, 2
       ORDER BY count DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((r) => ({
      origin: r.origin,
      destination: r.destination,
      count: parseInt(r.count, 10),
    }));
  } finally {
    client.release();
  }
}

export async function getFeatureUsage(): Promise<FeatureUsageRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ event_type: string; count: string }>(
      `SELECT event_type, COUNT(*) AS count
       FROM usage_events
       GROUP BY event_type
       ORDER BY count DESC`
    );
    return result.rows.map((r) => ({
      feature: r.event_type,
      count: parseInt(r.count, 10),
    }));
  } finally {
    client.release();
  }
}
