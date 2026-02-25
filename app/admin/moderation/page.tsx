"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { TimeAgo } from "@/components/admin/TimeAgo";

interface ReportRow {
  id: string;
  type: string;
  title: string;
  severity: string;
  state: string | null;
  upvotes: number;
  downvotes: number;
  moderation_status: string | null;
  user_email: string | null;
  created_at: string;
  is_active: boolean;
}

interface ReportStats {
  byStatus: Record<string, number>;
  byType: { type: string; count: number }[];
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ff4d4f",
  WARNING: "#ff8c00",
  ADVISORY: "#ffd000",
  INFO: "#4096ff",
};

type TabValue = "" | "pending" | "approved" | "removed";

export default function ModerationPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [tab, setTab] = useState<TabValue>("pending");
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (tab) params.set("moderation_status", tab);
    const [reportsRes, statsRes] = await Promise.allSettled([
      fetch(`/api/admin/reports?${params}`).then((r) => r.json()),
      fetch("/api/admin/reports/stats").then((r) => r.json()),
    ]);
    if (reportsRes.status === "fulfilled") setReports((reportsRes.value as { reports: ReportRow[] }).reports ?? []);
    if (statsRes.status === "fulfilled") setStats(statsRes.value as ReportStats);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchReports();
  }, [fetchReports]);

  async function moderate(id: string, action: string, reason?: string) {
    await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moderation_status: action, reason }),
    });
    void fetchReports();
  }

  const tabs: { value: TabValue; label: string }[] = [
    { value: "pending", label: `Pending (${stats?.byStatus?.pending ?? 0})` },
    { value: "approved", label: `Approved (${stats?.byStatus?.approved ?? 0})` },
    { value: "removed", label: `Removed (${stats?.byStatus?.removed ?? 0})` },
    { value: "", label: "All" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <AdminPageHeader title="Moderation" description="Review and moderate community reports" />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending" value={stats?.byStatus?.pending ?? "—"} status={(stats?.byStatus?.pending ?? 0) > 0 ? "warning" : "healthy"} />
        <StatCard label="Approved" value={stats?.byStatus?.approved ?? "—"} />
        <StatCard label="Removed" value={stats?.byStatus?.removed ?? "—"} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b" style={{ borderColor: "var(--rp-border)" }}>
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: tab === t.value ? "#4096ff" : "transparent",
              color: tab === t.value ? "#4096ff" : "var(--rp-text-muted)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--rp-text-muted)" }}>Loading…</p>
      ) : reports.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--rp-text-muted)" }}>
          No reports in this queue.
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-mono"
                      style={{
                        backgroundColor: `${SEVERITY_COLORS[report.severity] ?? "#4096ff"}22`,
                        color: SEVERITY_COLORS[report.severity] ?? "#4096ff",
                      }}
                    >
                      {report.severity}
                    </span>
                    <span className="text-xs" style={{ color: "var(--rp-text-muted)" }}>
                      {report.type}
                    </span>
                    {report.state && (
                      <span className="text-xs font-mono" style={{ color: "var(--rp-text-muted)" }}>
                        {report.state}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-sm font-medium" style={{ color: "var(--rp-text)" }}>
                    {report.title}
                  </h3>
                  <div className="mt-1 flex gap-3 text-xs" style={{ color: "var(--rp-text-muted)" }}>
                    <span>by {report.user_email ?? "anonymous"}</span>
                    <span><TimeAgo date={report.created_at} /></span>
                    <span>▲{report.upvotes} ▼{report.downvotes}</span>
                  </div>
                </div>

                {report.moderation_status !== "removed" && (
                  <div className="flex gap-2 flex-none">
                    {report.moderation_status !== "approved" && (
                      <button
                        onClick={() => void moderate(report.id, "approved")}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ backgroundColor: "#36cfc915", color: "#36cfc9", border: "1px solid #36cfc940" }}
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => void moderate(report.id, "removed", "Admin removed")}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ backgroundColor: "#ff4d4f15", color: "#ff4d4f", border: "1px solid #ff4d4f40" }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
