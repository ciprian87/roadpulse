import { pool } from "@/lib/db/index";

export interface FeedStatusRecord {
  feed_name: string;
  status: string;
  last_success_at: Date | null;
  last_error_at: Date | null;
  last_error_message: string | null;
  record_count: number | null;
  avg_fetch_ms: number | null;
  updated_at: Date;
}

export async function getActiveAlertCount(): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM weather_alerts WHERE is_active = true"
    );
    return parseInt(result.rows[0]?.count ?? "0", 10);
  } finally {
    client.release();
  }
}

export async function getNwsFeedStatus(): Promise<FeedStatusRecord | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<FeedStatusRecord>(
      "SELECT feed_name, status, last_success_at, last_error_at, last_error_message, record_count, avg_fetch_ms, updated_at FROM feed_status WHERE feed_name = $1",
      ["nws-alerts"]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}
