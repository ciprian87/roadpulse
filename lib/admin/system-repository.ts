import { pool } from "@/lib/db";

export interface TableStat {
  table_name: string;
  row_estimate: number;
  total_size: string;
}

export interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latency_ms?: number;
  detail?: string;
}

export interface PerformanceMetric {
  event_type: string;
  count: number;
  avg_ms: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
}

export interface ScheduledJobStatus {
  feed_name: string;
  state: string | null;
  status: string;
  last_success_at: string | null;
  refresh_interval_minutes: number | null;
  is_enabled: boolean | null;
  next_expected_at: string | null;
}

export async function getDatabaseStats(): Promise<TableStat[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ table_name: string; row_estimate: string; total_size: string }>(
      `SELECT
         relname AS table_name,
         n_live_tup AS row_estimate,
         pg_size_pretty(pg_total_relation_size(quote_ident(relname))) AS total_size
       FROM pg_stat_user_tables
       ORDER BY pg_total_relation_size(quote_ident(relname)) DESC`
    );
    return result.rows.map((r) => ({
      table_name: r.table_name,
      row_estimate: parseInt(r.row_estimate, 10),
      total_size: r.total_size,
    }));
  } finally {
    client.release();
  }
}

export async function getScheduledJobs(): Promise<ScheduledJobStatus[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      feed_name: string;
      state: string | null;
      status: string;
      last_success_at: Date | null;
      refresh_interval_minutes: number | null;
      is_enabled: boolean | null;
    }>(
      `SELECT feed_name, state, status, last_success_at, refresh_interval_minutes, is_enabled
       FROM feed_status
       ORDER BY state NULLS LAST, feed_name`
    );

    return result.rows.map((r) => {
      let nextExpected: string | null = null;
      if (r.last_success_at && r.refresh_interval_minutes) {
        const next = new Date(
          r.last_success_at.getTime() + r.refresh_interval_minutes * 60_000
        );
        nextExpected = next.toISOString();
      }
      return {
        feed_name: r.feed_name,
        state: r.state,
        status: r.status,
        last_success_at: r.last_success_at ? r.last_success_at.toISOString() : null,
        refresh_interval_minutes: r.refresh_interval_minutes,
        is_enabled: r.is_enabled,
        next_expected_at: nextExpected,
      };
    });
  } finally {
    client.release();
  }
}

export async function getApiPerformanceMetrics(): Promise<PerformanceMetric[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      event_type: string;
      count: string;
      avg_ms: string | null;
      p50_ms: string | null;
      p95_ms: string | null;
    }>(
      `SELECT
         event_type,
         COUNT(*) AS count,
         AVG((metadata->>'duration_ms')::numeric)::numeric(10,1) AS avg_ms,
         PERCENTILE_CONT(0.5) WITHIN GROUP (
           ORDER BY (metadata->>'duration_ms')::numeric
         )::numeric(10,1) AS p50_ms,
         PERCENTILE_CONT(0.95) WITHIN GROUP (
           ORDER BY (metadata->>'duration_ms')::numeric
         )::numeric(10,1) AS p95_ms
       FROM usage_events
       WHERE metadata->>'duration_ms' IS NOT NULL
       GROUP BY event_type
       ORDER BY count DESC`
    );
    return result.rows.map((r) => ({
      event_type: r.event_type,
      count: parseInt(r.count, 10),
      avg_ms: r.avg_ms ? parseFloat(r.avg_ms) : null,
      p50_ms: r.p50_ms ? parseFloat(r.p50_ms) : null,
      p95_ms: r.p95_ms ? parseFloat(r.p95_ms) : null,
    }));
  } finally {
    client.release();
  }
}
