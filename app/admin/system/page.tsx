"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StatusDot } from "@/components/admin/StatusDot";
import { TimeAgo } from "@/components/admin/TimeAgo";
import { DataTable, type Column } from "@/components/admin/DataTable";
import type { TableStat, ScheduledJobStatus, PerformanceMetric } from "@/lib/admin/system-repository";
import type { QueueStatus } from "@/lib/jobs/ingestion-queue";

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latency_ms?: number;
  detail?: string;
}

export default function SystemPage() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [tables, setTables] = useState<TableStat[]>([]);
  const [jobs, setJobs] = useState<ScheduledJobStatus[]>([]);
  const [perf, setPerf] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduler, setScheduler] = useState<QueueStatus | null>(null);
  const [schedulerBusy, setSchedulerBusy] = useState(false);
  const [intervalInput, setIntervalInput] = useState<string>("");

  const fetchAll = useCallback(async () => {
    const [svcRes, dbRes, jobRes, perfRes, schedRes] = await Promise.allSettled([
      fetch("/api/admin/system/health").then((r) => r.json()),
      fetch("/api/admin/system/database").then((r) => r.json()),
      fetch("/api/admin/system/jobs").then((r) => r.json()),
      fetch("/api/admin/system/performance").then((r) => r.json()),
      fetch("/api/admin/jobs").then((r) => r.json()),
    ]);
    if (svcRes.status === "fulfilled") setServices((svcRes.value as { services: ServiceHealth[] }).services ?? []);
    if (dbRes.status === "fulfilled") setTables((dbRes.value as { tables: TableStat[] }).tables ?? []);
    if (jobRes.status === "fulfilled") setJobs((jobRes.value as { jobs: ScheduledJobStatus[] }).jobs ?? []);
    if (perfRes.status === "fulfilled") setPerf((perfRes.value as { metrics: PerformanceMetric[] }).metrics ?? []);
    if (schedRes.status === "fulfilled") {
      const s = schedRes.value as QueueStatus;
      setScheduler(s);
      setIntervalInput((prev) => (prev === "" ? String(s.intervalMinutes ?? 5) : prev));
    }
    setLoading(false);
  }, []);

  // Track whether intervalInput has been manually set by the user so we don't
  // overwrite it with the polled value while they are typing.
  const intervalDirtyRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  async function schedulerAction(
    action: "pause" | "resume" | "trigger" | "set-interval",
    extra?: { intervalMinutes: number }
  ): Promise<void> {
    setSchedulerBusy(true);
    await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setSchedulerBusy(false);
    intervalDirtyRef.current = false;
    await fetchAll();
  }

  const healthy = services.filter((s) => s.status === "healthy").length;

  const tableCols: Column<Record<string, unknown>>[] = [
    { key: "table_name", label: "Table", render: (r) => <span className="font-mono text-xs">{String(r.table_name)}</span> },
    { key: "row_estimate", label: "Rows", render: (r) => <span className="font-mono text-xs">{Number(r.row_estimate).toLocaleString()}</span> },
    { key: "total_size", label: "Size", render: (r) => <span className="font-mono text-xs">{String(r.total_size)}</span> },
  ];

  const perfCols: Column<Record<string, unknown>>[] = [
    { key: "event_type", label: "Event", render: (r) => <span className="font-mono text-xs">{String(r.event_type)}</span> },
    { key: "count", label: "Count", render: (r) => <span className="font-mono text-xs">{Number(r.count).toLocaleString()}</span> },
    { key: "avg_ms", label: "Avg ms", render: (r) => <span className="font-mono text-xs">{r.avg_ms != null ? String(r.avg_ms) : "—"}</span> },
    { key: "p50_ms", label: "p50 ms", render: (r) => <span className="font-mono text-xs">{r.p50_ms != null ? String(r.p50_ms) : "—"}</span> },
    { key: "p95_ms", label: "p95 ms", render: (r) => <span className="font-mono text-xs">{r.p95_ms != null ? String(r.p95_ms) : "—"}</span> },
  ];

  if (loading) return <div style={{ color: "var(--rp-text-muted)" }}>Loading…</div>;

  return (
    <div className="space-y-6 max-w-7xl">
      <AdminPageHeader title="System Health" description="Service status, database metrics, and scheduled jobs" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Healthy Services" value={`${healthy}/${services.length}`} status={healthy === services.length ? "healthy" : "warning"} />
        <StatCard label="DB Tables" value={tables.length} />
        <StatCard label="Registered Feeds" value={jobs.length} />
        <StatCard label="Enabled Feeds" value={jobs.filter((j) => j.is_enabled !== false).length} />
      </div>

      {/* Scheduler control panel */}
      {scheduler !== null && (
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--rp-text)" }}>Scheduler</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--rp-text-muted)" }}>
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                  style={{ backgroundColor: scheduler.isPaused ? "#ff4d4f" : "#36cfc9", verticalAlign: "middle" }}
                />
                {scheduler.isPaused ? "Paused" : "Running"}
                {scheduler.intervalMinutes !== null && !scheduler.isPaused && (
                  <> · Every {scheduler.intervalMinutes} min</>
                )}
                {scheduler.nextRunAt !== null && !scheduler.isPaused && (
                  <> · Next run <TimeAgo date={new Date(scheduler.nextRunAt).toISOString()} fallback="soon" /></>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void schedulerAction(scheduler.isPaused ? "resume" : "pause")}
                disabled={schedulerBusy}
                className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                style={{
                  backgroundColor: scheduler.isPaused ? "#36cfc915" : "#ff4d4f15",
                  color: scheduler.isPaused ? "#36cfc9" : "#ff4d4f",
                  border: `1px solid ${scheduler.isPaused ? "#36cfc940" : "#ff4d4f40"}`,
                }}
              >
                {scheduler.isPaused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={() => void schedulerAction("trigger")}
                disabled={schedulerBusy}
                className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                style={{
                  backgroundColor: "#4096ff15",
                  color: "#4096ff",
                  border: "1px solid #4096ff40",
                }}
              >
                Run Now
              </button>
            </div>
          </div>

          {/* Interval control */}
          <div className="flex items-center gap-3">
            <label className="text-xs" style={{ color: "var(--rp-text-muted)" }}>Interval (minutes)</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={intervalInput}
              onChange={(e) => {
                intervalDirtyRef.current = true;
                setIntervalInput(e.target.value);
              }}
              className="w-20 px-2 py-1 rounded text-xs font-mono text-right"
              style={{
                backgroundColor: "var(--rp-bg)",
                border: "1px solid var(--rp-border)",
                color: "var(--rp-text)",
              }}
            />
            <button
              onClick={() => {
                const mins = parseFloat(intervalInput);
                if (!isNaN(mins) && mins >= 1) {
                  void schedulerAction("set-interval", { intervalMinutes: mins });
                }
              }}
              disabled={schedulerBusy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{
                backgroundColor: "var(--rp-bg)",
                border: "1px solid var(--rp-border)",
                color: "var(--rp-text)",
              }}
            >
              Save
            </button>
            {scheduler.lastRunAt !== null && (
              <span className="text-xs ml-2" style={{ color: "var(--rp-text-muted)" }}>
                Last run: <TimeAgo date={new Date(scheduler.lastRunAt).toISOString()} />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Service cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map((svc) => (
          <div
            key={svc.name}
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: "var(--rp-text-muted)" }}>{svc.name}</p>
            <StatusDot status={svc.status} />
            {svc.latency_ms !== undefined && (
              <p className="text-xs mt-1 font-mono" style={{ color: "var(--rp-text-muted)" }}>{svc.latency_ms}ms</p>
            )}
            {svc.detail && (
              <p className="text-xs mt-1 truncate" style={{ color: "#ff4d4f" }} title={svc.detail}>{svc.detail}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DB table sizes */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--rp-text)" }}>Database Tables</h2>
          <DataTable columns={tableCols} data={tables as unknown as Record<string, unknown>[]} emptyMessage="No table data." />
        </div>

        {/* Performance */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--rp-text)" }}>API Performance</h2>
          <DataTable columns={perfCols} data={perf as unknown as Record<string, unknown>[]} emptyMessage="No performance data yet. Usage events with duration_ms metadata will appear here." />
        </div>
      </div>

      {/* Scheduled jobs */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--rp-text)" }}>Scheduled Jobs</h2>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--rp-border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "var(--rp-surface)", borderBottom: "1px solid var(--rp-border)" }}>
                {["Feed", "State", "Status", "Last Success", "Next Expected", "Interval", "Enabled"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold" style={{ color: "var(--rp-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.feed_name} style={{ borderBottom: "1px solid var(--rp-border)" }}>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "var(--rp-text)" }}>{job.feed_name}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--rp-text-muted)" }}>{job.state ?? "—"}</td>
                  <td className="px-3 py-2.5"><StatusDot status={job.status as "healthy" | "degraded" | "down" | "unknown"} /></td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--rp-text-muted)" }}><TimeAgo date={job.last_success_at} /></td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--rp-text-muted)" }}><TimeAgo date={job.next_expected_at} fallback="—" /></td>
                  <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--rp-text-muted)" }}>{job.refresh_interval_minutes ?? 5}m</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: job.is_enabled !== false ? "#36cfc9" : "#6a6a8a" }}>
                    {job.is_enabled !== false ? "yes" : "no"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
