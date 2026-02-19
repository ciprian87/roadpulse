import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RoadPulse",
  description:
    "Real-time road closures, weather alerts, and hazards for commercial truck drivers",
};

// Disable static caching so the health status is always live
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
    // In server components we call the local API directly
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

export default async function Home() {
  const health = await fetchHealth();

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
            {/* Connection status */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                Infrastructure
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Database */}
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

                {/* Redis */}
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

            {/* Table row counts */}
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
          <h2 className="text-sm font-semibold text-zinc-400 mb-1">Phase 0</h2>
          <p className="text-zinc-500 text-sm leading-relaxed">
            Project scaffolding complete. Next up: feed ingestion pipeline, NWS
            weather alerts, and the route hazard API.
          </p>
        </section>
      </div>
    </main>
  );
}
