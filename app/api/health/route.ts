import { NextResponse } from "next/server";
import { Pool } from "pg";
import Redis from "ioredis";

interface TableCount {
  table: string;
  rows: number;
}

interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  database: {
    connected: boolean;
    postgis: boolean;
    tables: TableCount[];
    error?: string;
  };
  redis: {
    connected: boolean;
    error?: string;
  };
}

const TRACKED_TABLES = [
  "road_events",
  "weather_alerts",
  "parking_facilities",
  "users",
  "saved_routes",
  "community_reports",
  "feed_status",
];

async function checkDatabase(): Promise<HealthResponse["database"]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { connected: false, postgis: false, tables: [], error: "DATABASE_URL not set" };
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect().catch(() => null);

  if (!client) {
    await pool.end().catch(() => undefined);
    return { connected: false, postgis: false, tables: [], error: "Connection refused" };
  }

  try {
    // Verify PostGIS is available
    const postgisResult = await client
      .query<{ postgis_version: string }>(
        "SELECT PostGIS_Version() AS postgis_version"
      )
      .catch(() => null);

    const postgisOk = postgisResult !== null;

    // Count rows in each tracked table — tables that don't exist yet return 0
    const tables: TableCount[] = [];
    for (const table of TRACKED_TABLES) {
      const exists = await client
        .query<{ exists: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)",
          [table]
        )
        .then((r) => r.rows[0]?.exists ?? false)
        .catch(() => false);

      if (exists) {
        const count = await client
          .query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`)
          .then((r) => parseInt(r.rows[0]?.count ?? "0", 10))
          .catch(() => 0);
        tables.push({ table, rows: count });
      } else {
        tables.push({ table, rows: 0 });
      }
    }

    return { connected: true, postgis: postgisOk, tables };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { connected: true, postgis: false, tables: [], error: message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function checkRedis(): Promise<HealthResponse["redis"]> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { connected: false, error: "REDIS_URL not set" };
  }

  const redis = new Redis(redisUrl, {
    // Don't retry on startup health checks — fail fast
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.ping();
    return { connected: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { connected: false, error: message };
  } finally {
    await redis.quit().catch(() => undefined);
  }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const status = database.connected && redis.connected ? "ok" : "degraded";

  return NextResponse.json(
    { status, timestamp: new Date().toISOString(), database, redis },
    { status: status === "ok" ? 200 : 503 }
  );
}
