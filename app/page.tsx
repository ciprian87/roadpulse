import type { Metadata } from "next";
import { RefreshButton } from "@/components/shared/RefreshButton";
import {
  getActiveAlertCount,
  getNwsFeedStatus,
} from "@/lib/weather/weather-repository";

export const metadata: Metadata = {
  title: "RoadPulse",
  description:
    "Real-time road closures, weather alerts, and hazards for commercial truck drivers",
};

// Disable static caching so the health status and alert counts are always live
export const revalidate = 0;

interface TableCount {
  table: string;
  rows: number;
}

interface HealthData {
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

async function fetchHealth(): Promise<HealthData | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
    return (await res.json()) as HealthData;
  } catch {
    return null;
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
        ok
          ? "bg-teal-950 text-teal-300 ring-1 ring-teal-600"
          : "bg-red-950 text-red-300 ring-1 ring-red-600"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${ok ? "bg-teal-400" : "bg-red-400"}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function FeedStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
    healthy: {
      bg: "bg-teal-950",
      text: "text-teal-300",
      ring: "ring-teal-600",
      dot: "bg-teal-400",
    },
    degraded: {
      bg: "bg-yellow-950",
      text: "text-yellow-300",
      ring: "ring-yellow-600",
      dot: "bg-yellow-400",
    },
    down: {
      bg: "bg-red-950",
      text: "text-red-300",
      ring: "ring-red-600",
      dot: "bg-red-400",
    },
    unknown: {
      bg: "bg-zinc-800",
      text: "text-zinc-400",
      ring: "ring-zinc-600",
      dot: "bg-zinc-500",
    },
  };
  const c = configs[status] ?? configs.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${c.bg} ${c.text} ring-1 ${c.ring}`}
    >
      <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "never";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default async function Home() {
  // Fetch all data in parallel — health check, alert count, feed status
  const [health, alertCount, feedStatus] = await Promise.all([
    fetchHealth(),
    getActiveAlertCount().catch(() => null),
    getNwsFeedStatus().catch(() => null),
  ]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              RoadPulse
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Real-time hazards for commercial truck drivers
            </p>
          </div>
          {health && (
            <StatusBadge
              ok={health.status === "ok"}
              label={
                health.status === "ok" ? "All systems operational" : "Degraded"
              }
            />
          )}
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        {health === null ? (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-6 text-red-300">
            Could not reach the health API. Make sure the dev server is running.
          </div>
        ) : (
          <>
            {/* Infrastructure */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                Infrastructure
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-zinc-200">
                      PostgreSQL + PostGIS
                    </span>
                    <StatusBadge
                      ok={health.database.connected}
                      label={
                        health.database.connected ? "Connected" : "Offline"
                      }
                    />
                  </div>
                  {health.database.connected && (
                    <p className="text-sm text-zinc-500">
                      PostGIS:{" "}
                      <span
                        className={
                          health.database.postgis
                            ? "text-teal-400"
                            : "text-red-400"
                        }
                      >
                        {health.database.postgis ? "available" : "missing"}
                      </span>
                    </p>
                  )}
                  {health.database.error && (
                    <p className="text-sm text-red-400 mt-1">
                      {health.database.error}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-200">Redis</span>
                    <StatusBadge
                      ok={health.redis.connected}
                      label={health.redis.connected ? "Connected" : "Offline"}
                    />
                  </div>
                  {health.redis.error && (
                    <p className="text-sm text-red-400 mt-1">
                      {health.redis.error}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* NWS Weather Alerts */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                NWS Weather Alerts
              </h2>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
                {/* Alert count + refresh */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-3xl font-bold tabular-nums text-white">
                      {alertCount ?? "—"}
                    </span>
                    <span className="ml-2 text-sm text-zinc-400">
                      active road-relevant alerts
                    </span>
                  </div>
                  <RefreshButton />
                </div>

                {/* Feed status */}
                {feedStatus ? (
                  <div className="border-t border-zinc-800 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-500 mb-1">Status</p>
                      <FeedStatusBadge status={feedStatus.status} />
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-1">Last success</p>
                      <p className="text-zinc-300 font-mono">
                        {formatRelativeTime(feedStatus.last_success_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-1">Record count</p>
                      <p className="text-zinc-300 font-mono tabular-nums">
                        {feedStatus.record_count ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-1">Avg fetch</p>
                      <p className="text-zinc-300 font-mono tabular-nums">
                        {feedStatus.avg_fetch_ms != null
                          ? `${feedStatus.avg_fetch_ms}ms`
                          : "—"}
                      </p>
                    </div>
                    {feedStatus.last_error_message && (
                      <div className="col-span-2 sm:col-span-4">
                        <p className="text-zinc-500 mb-1">Last error</p>
                        <p className="text-red-400 text-xs font-mono break-words">
                          {feedStatus.last_error_message}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600 border-t border-zinc-800 pt-4">
                    No ingestion run yet — click{" "}
                    <span className="text-zinc-400">Refresh Now</span> to fetch
                    the first batch of NWS alerts.
                  </p>
                )}
              </div>
            </section>

            {/* Database table row counts */}
            {health.database.tables.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                  Database Tables
                </h2>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left px-5 py-3 text-zinc-400 font-medium">
                          Table
                        </th>
                        <th className="text-right px-5 py-3 text-zinc-400 font-medium">
                          Rows
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {health.database.tables.map(({ table, rows }) => (
                        <tr
                          key={table}
                          className="hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="px-5 py-3 font-mono text-zinc-300">
                            {table}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-zinc-400">
                            {rows.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <p className="text-xs text-zinc-600">
              Last checked:{" "}
              <time dateTime={health.timestamp}>
                {new Date(health.timestamp).toLocaleString()}
              </time>
            </p>
          </>
        )}

        {/* Phase indicator */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-semibold text-zinc-400 mb-1">Phase 1</h2>
          <p className="text-zinc-500 text-sm leading-relaxed">
            NWS weather alert ingestion pipeline complete. Next up: state 511
            road closure feeds, route geometry, and the hazard corridor API.
          </p>
        </section>
      </div>
    </main>
  );
}
