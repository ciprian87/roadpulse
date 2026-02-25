"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { StatCard } from "@/components/admin/StatCard";
import { StatusDot } from "@/components/admin/StatusDot";
import { ActivityFeed, type ActivityEvent } from "@/components/admin/ActivityFeed";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface OverviewStats {
  activeRoadEvents: number;
  activeWeatherAlerts: number;
  registeredUsers: number;
  routeChecksToday: number;
  pendingReports: number;
}

interface TimeSeriesPoint { date: string; count: number; }
interface StateCount { state: string; count: number; }
interface ServiceInfo { name: string; status: "healthy" | "degraded" | "down" | "unknown"; }

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [routeSeries, setRouteSeries] = useState<TimeSeriesPoint[]>([]);
  const [stateEvents, setStateEvents] = useState<StateCount[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [statsRes, routeRes, stateRes, actRes, svcRes] = await Promise.allSettled([
      fetch("/api/admin/stats/overview").then((r) => r.json()),
      fetch("/api/admin/stats/route-checks?days=7").then((r) => r.json()),
      fetch("/api/admin/stats/events-by-state").then((r) => r.json()),
      fetch("/api/admin/stats/activity").then((r) => r.json()),
      fetch("/api/admin/system/health").then((r) => r.json()),
    ]);

    if (statsRes.status === "fulfilled") setStats(statsRes.value as OverviewStats);
    if (routeRes.status === "fulfilled") setRouteSeries((routeRes.value as { series: TimeSeriesPoint[] }).series ?? []);
    if (stateRes.status === "fulfilled") setStateEvents((stateRes.value as { data: StateCount[] }).data ?? []);
    if (actRes.status === "fulfilled") setActivity((actRes.value as { events: ActivityEvent[] }).events ?? []);
    if (svcRes.status === "fulfilled") setServices((svcRes.value as { services: ServiceInfo[] }).services ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded" style={{ backgroundColor: "var(--rp-surface)" }} />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl" style={{ backgroundColor: "var(--rp-surface)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <AdminPageHeader
        title="Overview"
        description="Real-time platform health and usage metrics"
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Road Events" value={stats?.activeRoadEvents ?? "—"} />
        <StatCard label="Active Weather Alerts" value={stats?.activeWeatherAlerts ?? "—"} />
        <StatCard label="Registered Users" value={stats?.registeredUsers ?? "—"} />
        <StatCard label="Route Checks Today" value={stats?.routeChecksToday ?? "—"} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route checks line chart */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--rp-text)" }}>
            Route Checks — Last 7 Days
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={routeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--rp-text-muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--rp-text-muted)" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="count" stroke="#4096ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Events by state bar chart */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--rp-text)" }}>
            Active Events by State (Top 10)
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stateEvents} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-border)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--rp-text-muted)" }} />
              <YAxis type="category" dataKey="state" tick={{ fontSize: 10, fill: "var(--rp-text-muted)" }} width={24} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)", fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#36cfc9" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System health mini */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--rp-text)" }}>
            System Health
          </h2>
          <div className="space-y-2">
            {services.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--rp-text-muted)" }}>Loading…</p>
            ) : (
              services.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--rp-text-muted)" }}>{svc.name}</span>
                  <StatusDot status={svc.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending reports */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--rp-text)" }}>
            Moderation Queue
          </h2>
          <p className="text-4xl font-bold font-mono" style={{ color: (stats?.pendingReports ?? 0) > 0 ? "#ffd000" : "#36cfc9" }}>
            {stats?.pendingReports ?? "—"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--rp-text-muted)" }}>
            Reports awaiting moderation
          </p>
          <a
            href="/admin/moderation"
            className="inline-block mt-3 text-xs px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: "#4096ff22", color: "#4096ff" }}
          >
            Review →
          </a>
        </div>

        {/* Activity feed */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--rp-text)" }}>
            Recent Activity
          </h2>
          <ActivityFeed events={activity.slice(0, 6)} />
        </div>
      </div>
    </div>
  );
}
