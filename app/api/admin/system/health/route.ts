import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { pool } from "@/lib/db";
import Redis from "ioredis";

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latency_ms?: number;
  detail?: string;
}

async function checkPostgres(): Promise<ServiceHealth> {
  const start = Date.now();
  const client = await pool.connect().catch(() => null);
  if (!client) return { name: "PostgreSQL", status: "down", detail: "Could not acquire connection" };
  try {
    await client.query("SELECT 1");
    return { name: "PostgreSQL", status: "healthy", latency_ms: Date.now() - start };
  } catch (err: unknown) {
    return {
      name: "PostgreSQL",
      status: "down",
      detail: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    client.release();
  }
}

async function checkRedis(): Promise<ServiceHealth> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return { name: "Redis", status: "unknown", detail: "REDIS_URL not set" };

  const start = Date.now();
  let redis: Redis | null = null;
  try {
    redis = new Redis(redisUrl, { lazyConnect: true, enableOfflineQueue: false });
    await redis.connect();
    await redis.ping();
    return { name: "Redis", status: "healthy", latency_ms: Date.now() - start };
  } catch (err: unknown) {
    return {
      name: "Redis",
      status: "down",
      detail: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    if (redis) await redis.quit().catch(() => undefined);
  }
}

async function checkORS(): Promise<ServiceHealth> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) return { name: "OpenRouteService", status: "unknown", detail: "API key not set" };

  // /v2/status does not exist on the ORS public API. Use a minimal geocoding
  // probe instead — same endpoint the app uses, validates reachability + key.
  const start = Date.now();
  try {
    const url =
      `https://api.openrouteservice.org/geocode/search` +
      `?api_key=${encodeURIComponent(apiKey)}&text=a&size=1&boundary.country=US`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { name: "OpenRouteService", status: "degraded", detail: `HTTP ${res.status}` };
    return { name: "OpenRouteService", status: "healthy", latency_ms: Date.now() - start };
  } catch (err: unknown) {
    return {
      name: "OpenRouteService",
      status: "down",
      detail: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkNWS(): Promise<ServiceHealth> {
  // Don't probe NWS live — it's flaky enough to false-positive constantly.
  // The map shows data from the DB, not from a live NWS request, so the
  // meaningful health signal is whether the ingest pipeline last ran successfully.
  // Stale = no successful run in the last 30 minutes.
  const client = await pool.connect();
  try {
    const result = await client.query<{
      status: string;
      last_success_at: Date | null;
      last_error_message: string | null;
    }>(
      `SELECT status, last_success_at, last_error_message
       FROM feed_status
       WHERE feed_name = 'nws-alerts'
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return { name: "NWS API", status: "unknown", detail: "No ingest run recorded yet" };
    }

    const row = result.rows[0];
    const staleThresholdMs = 30 * 60 * 1000; // 30 minutes
    const isStale =
      !row.last_success_at ||
      Date.now() - row.last_success_at.getTime() > staleThresholdMs;

    if (row.status === "healthy" && !isStale) {
      return { name: "NWS API", status: "healthy" };
    }
    if (row.status === "healthy" && isStale) {
      return { name: "NWS API", status: "degraded", detail: "Last success >30 min ago" };
    }
    return {
      name: "NWS API",
      status: "down",
      detail: row.last_error_message ?? "Last ingest failed",
    };
  } finally {
    client.release();
  }
}

export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [postgres, redis, ors, nws] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkORS(),
    checkNWS(),
  ]);

  const services: ServiceHealth[] = [postgres, redis, ors, nws];
  const overall = services.every((s) => s.status === "healthy")
    ? "healthy"
    : services.some((s) => s.status === "down")
    ? "degraded"
    : "degraded";

  return NextResponse.json({ overall, services });
}
