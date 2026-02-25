"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import type { TimeSeriesPoint, HourlyPoint, CorridorRow, FeatureUsageRow } from "@/lib/admin/usage-repository";

export default function AnalyticsPage() {
  const [routeSeries, setRouteSeries] = useState<TimeSeriesPoint[]>([]);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [corridors, setCorridors] = useState<CorridorRow[]>([]);
  const [features, setFeatures] = useState<FeatureUsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/admin/analytics/route-checks?days=30").then((r) => r.json()),
      fetch("/api/admin/analytics/usage-by-hour").then((r) => r.json()),
      fetch("/api/admin/analytics/top-corridors?limit=20").then((r) => r.json()),
      fetch("/api/admin/analytics/feature-usage").then((r) => r.json()),
    ]).then(([rcRes, hourRes, corrRes, featRes]) => {
      if (rcRes.status === "fulfilled") setRouteSeries((rcRes.value as { series: TimeSeriesPoint[] }).series ?? []);
      if (hourRes.status === "fulfilled") setHourly((hourRes.value as { data: HourlyPoint[] }).data ?? []);
      if (corrRes.status === "fulfilled") setCorridors((corrRes.value as { data: CorridorRow[] }).data ?? []);
      if (featRes.status === "fulfilled") setFeatures((featRes.value as { data: FeatureUsageRow[] }).data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const corridorCols: Column<Record<string, unknown>>[] = [
    { key: "origin", label: "Origin" },
    { key: "destination", label: "Destination" },
    { key: "count", label: "Checks", render: (r) => <span className="font-mono">{String(r.count)}</span> },
  ];

  if (loading) {
    return <div style={{ color: "var(--rp-text-muted)" }}>Loading…</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <AdminPageHeader title="Analytics" description="Route check patterns, feature usage, and corridor trends" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route checks 30d */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--rp-text)" }}>Route Checks — Last 30 Days</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={routeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--rp-text-muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--rp-text-muted)" }} />
              <Tooltip contentStyle={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)", fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#4096ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Usage by hour */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--rp-text)" }}>Route Checks by Hour of Day</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "var(--rp-text-muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--rp-text-muted)" }} />
              <Tooltip contentStyle={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)", fontSize: 12 }} />
              <Bar dataKey="count" fill="#36cfc9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature usage bar */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--rp-text)" }}>Feature Usage</h2>
          {features.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--rp-text-muted)" }}>No usage data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={features} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-border)" />
                <XAxis type="number" tick={{ fontSize: 9, fill: "var(--rp-text-muted)" }} />
                <YAxis type="category" dataKey="feature" tick={{ fontSize: 9, fill: "var(--rp-text-muted)" }} width={110} />
                <Tooltip contentStyle={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)", fontSize: 12 }} />
                <Bar dataKey="count" fill="#ff8c00" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top corridors */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--rp-text)" }}>Top Corridors</h2>
          <DataTable
            columns={corridorCols}
            data={corridors as unknown as Record<string, unknown>[]}
            emptyMessage="No corridor data yet."
          />
        </div>
      </div>
    </div>
  );
}
