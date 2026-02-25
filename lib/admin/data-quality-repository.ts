import { pool } from "@/lib/db";

export interface StateQualityMetric {
  state: string;
  total_events: number;
  missing_geometry_pct: number;
  missing_description_pct: number;
  avg_age_hours: number;
  quality_score: number;
}

export interface AnomalyRow {
  type: string;
  label: string;
  detail: string;
  severity: "warning" | "critical";
}

export interface FeedCoverageRow {
  state: string;
  has_feed: boolean;
  feed_name: string | null;
  status: string | null;
}

export async function getStateQualityMetrics(): Promise<StateQualityMetric[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      state: string;
      total: string;
      no_geom: string;
      no_desc: string;
      avg_age: string;
    }>(
      `SELECT
         state,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE geometry IS NULL) AS no_geom,
         COUNT(*) FILTER (WHERE description IS NULL OR description = '') AS no_desc,
         COALESCE(
           EXTRACT(EPOCH FROM AVG(NOW() - COALESCE(last_updated_at, created_at))) / 3600,
           0
         )::numeric(10,1) AS avg_age
       FROM road_events
       WHERE is_active = true
       GROUP BY state
       ORDER BY total DESC`
    );

    return result.rows.map((r) => {
      const total = parseInt(r.total, 10);
      const noGeom = parseInt(r.no_geom, 10);
      const noDesc = parseInt(r.no_desc, 10);
      const avgAge = parseFloat(r.avg_age);
      const missingGeomPct = total > 0 ? Math.round((noGeom / total) * 100) : 0;
      const missingDescPct = total > 0 ? Math.round((noDesc / total) * 100) : 0;

      // Quality score 0-100: penalize missing geometry heavily, description less so, and age
      const score = Math.max(
        0,
        100 - missingGeomPct * 0.6 - missingDescPct * 0.2 - Math.min(avgAge, 48) * 0.2
      );

      return {
        state: r.state,
        total_events: total,
        missing_geometry_pct: missingGeomPct,
        missing_description_pct: missingDescPct,
        avg_age_hours: avgAge,
        quality_score: Math.round(score),
      };
    });
  } finally {
    client.release();
  }
}

export async function getAnomalies(): Promise<AnomalyRow[]> {
  const client = await pool.connect();
  try {
    const anomalies: AnomalyRow[] = [];

    // Zero-event states that have registered feeds
    const zeroResult = await client.query<{ state: string }>(
      `SELECT fs.state
       FROM feed_status fs
       LEFT JOIN (
         SELECT state, COUNT(*) AS cnt
         FROM road_events WHERE is_active = true
         GROUP BY state
       ) re ON re.state = fs.state
       WHERE fs.state IS NOT NULL
         AND (re.cnt IS NULL OR re.cnt = 0)
         AND fs.status = 'healthy'`
    );
    for (const row of zeroResult.rows) {
      anomalies.push({
        type: "zero_events",
        label: `${row.state}: Zero active events`,
        detail: "Feed is healthy but no active road events found for this state.",
        severity: "warning",
      });
    }

    // Feeds down > 30 minutes
    const downResult = await client.query<{ feed_name: string; state: string | null; minutes: string }>(
      `SELECT feed_name, state,
              EXTRACT(EPOCH FROM (NOW() - COALESCE(last_success_at, created_at::timestamptz))) / 60 AS minutes
       FROM feed_status
       WHERE status = 'down'
         AND COALESCE(last_success_at, updated_at) < NOW() - INTERVAL '30 minutes'`
    );
    for (const row of downResult.rows) {
      const mins = Math.round(parseFloat(row.minutes));
      anomalies.push({
        type: "feed_down",
        label: `${row.feed_name}: Down ${mins}m`,
        detail: `Feed has been in DOWN state for over ${mins} minutes.`,
        severity: mins > 120 ? "critical" : "warning",
      });
    }

    return anomalies;
  } finally {
    client.release();
  }
}

export async function getFeedCoverage(): Promise<FeedCoverageRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<FeedCoverageRow>(
      `SELECT
         fs.state,
         TRUE AS has_feed,
         fs.feed_name,
         fs.status
       FROM feed_status fs
       WHERE fs.state IS NOT NULL
       ORDER BY fs.state`
    );
    return result.rows;
  } finally {
    client.release();
  }
}
