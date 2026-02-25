import { pool } from "@/lib/db";

export interface AppSettingRow {
  key: string;
  value: unknown;
  updated_at: string | null;
  updated_by: string | null;
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ value: T }>(
      "SELECT value FROM app_settings WHERE key = $1",
      [key]
    );
    if (result.rows.length === 0) return defaultValue;
    return result.rows[0].value;
  } finally {
    client.release();
  }
}

export async function setSetting(
  key: string,
  value: unknown,
  updatedBy?: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO app_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET
         value      = EXCLUDED.value,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [key, JSON.stringify(value), updatedBy ?? null]
    );
  } finally {
    client.release();
  }
}

export async function getAllSettings(): Promise<AppSettingRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<AppSettingRow>(
      `SELECT key, value, updated_at::text, updated_by
       FROM app_settings
       ORDER BY key`
    );
    return result.rows;
  } finally {
    client.release();
  }
}
