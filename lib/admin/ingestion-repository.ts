import { pool } from "@/lib/db";

export interface IngestionLogRow {
  id: string;
  feed_name: string;
  status: string;
  duration_ms: number | null;
  records_inserted: number;
  records_updated: number;
  records_deactivated: number;
  records_errored: number;
  error_message: string | null;
  created_at: string;
}

export interface NewIngestionLog {
  feed_name: string;
  status: "success" | "partial" | "failed";
  duration_ms?: number;
  records_inserted?: number;
  records_updated?: number;
  records_deactivated?: number;
  records_errored?: number;
  error_message?: string | null;
  data_hash?: string | null;
}

export interface IngestionSeriesPoint {
  date: string;
  records: number;
  duration_ms: number;
}

export async function logIngestionRun(data: NewIngestionLog): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO ingestion_logs
         (feed_name, status, duration_ms, records_inserted, records_updated,
          records_deactivated, records_errored, error_message, data_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        data.feed_name,
        data.status,
        data.duration_ms ?? null,
        data.records_inserted ?? 0,
        data.records_updated ?? 0,
        data.records_deactivated ?? 0,
        data.records_errored ?? 0,
        data.error_message ?? null,
        data.data_hash ?? null,
      ]
    );
  } finally {
    client.release();
  }
}

export async function getIngestionHistory(feedName: string, limit = 20): Promise<IngestionLogRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<IngestionLogRow>(
      `SELECT id, feed_name, status, duration_ms,
              records_inserted, records_updated, records_deactivated, records_errored,
              error_message, created_at::text
       FROM ingestion_logs
       WHERE feed_name = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [feedName, limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getFeedIngestionSeries(feedName: string, days: number): Promise<IngestionSeriesPoint[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ date: string; records: string; duration_ms: string }>(
      `SELECT
         DATE_TRUNC('day', created_at)::date::text AS date,
         SUM(records_inserted + records_updated) AS records,
         AVG(duration_ms)::int AS duration_ms
       FROM ingestion_logs
       WHERE feed_name = $1
         AND created_at >= NOW() - ($2 * INTERVAL '1 day')
       GROUP BY 1
       ORDER BY 1`,
      [feedName, days]
    );
    return result.rows.map((r) => ({
      date: r.date,
      records: parseInt(r.records, 10),
      duration_ms: parseInt(r.duration_ms, 10),
    }));
  } finally {
    client.release();
  }
}
