import { Suspense } from "react";
import Link from "next/link";
import type { WeatherAlertApiItem, WeatherAlertsApiResponse } from "@/lib/types/weather";
import { SEVERITY_COLOR, severityLabel } from "@/lib/utils/severity";
import { FilterBar } from "./FilterBar";

// Always show live data — no ISR caching for the alerts list
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ severity?: string }>;
}

async function fetchAlerts(severity?: string): Promise<WeatherAlertApiItem[]> {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({ active_only: "true", limit: "200" });
  if (severity) params.set("severity", severity);

  const res = await fetch(`${base}/api/weather/alerts?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as WeatherAlertsApiResponse;
  return data.alerts;
}

function relativeExpiry(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const diffMs = date.getTime() - Date.now();
  const diffH = Math.round(diffMs / 3_600_000);
  if (diffMs < 0) {
    const ago = Math.abs(diffH);
    if (ago < 24) return `Expired ${ago}h ago`;
    return `Expired ${Math.round(ago / 24)}d ago`;
  }
  if (diffH < 1) return `Expires in ${Math.round(diffMs / 60_000)}m`;
  if (diffH < 24) return `Expires in ${diffH}h`;
  return `Expires ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function AlertCard({ alert }: { alert: WeatherAlertApiItem }) {
  const color = SEVERITY_COLOR[severityLabel(alert.severity)] ?? SEVERITY_COLOR.Unknown;
  const expiry = relativeExpiry(alert.expires);
  const isExpired = alert.expires ? new Date(alert.expires) < new Date() : false;

  return (
    // Tap navigates to map root (Phase 3 will deep-link via ?alert=<id>)
    <Link
      href={`/?alert=${alert.id}`}
      className="block rounded-xl p-4 transition-colors"
      style={{
        backgroundColor: "var(--rp-surface)",
        border: "1px solid var(--rp-border)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Severity dot */}
        <span
          className="mt-0.5 w-2.5 h-2.5 rounded-full flex-none"
          style={{ backgroundColor: color }}
          aria-label={`Severity: ${severityLabel(alert.severity)}`}
        />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className="text-xs font-semibold"
              style={{ color }}
            >
              {severityLabel(alert.severity)} · {alert.event}
            </p>
            {expiry && (
              <p
                className={`text-xs flex-none ${isExpired ? "text-red-400" : ""}`}
                style={isExpired ? undefined : { color: "var(--rp-text-muted)" }}
              >
                {expiry}
              </p>
            )}
          </div>

          <p
            className="text-sm font-medium leading-snug line-clamp-2"
            style={{ color: "var(--rp-text)" }}
          >
            {alert.headline ?? alert.event}
          </p>

          <p
            className="text-xs line-clamp-1"
            style={{ color: "var(--rp-text-muted)" }}
          >
            {alert.area_description}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default async function AlertsPage({ searchParams }: PageProps) {
  const { severity } = await searchParams;
  const alerts = await fetchAlerts(severity);

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ backgroundColor: "var(--rp-bg)" }}
    >
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Page header */}
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ color: "var(--rp-text)" }}
          >
            Active Alerts
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--rp-text-muted)" }}>
            {alerts.length} active NWS weather alert{alerts.length !== 1 ? "s" : ""}
            {severity ? ` · ${severity}` : ""}
          </p>
        </div>

        {/* Filter chips */}
        <Suspense>
          <FilterBar />
        </Suspense>

        {/* Alert cards */}
        {alerts.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{
              backgroundColor: "var(--rp-surface)",
              border: "1px solid var(--rp-border)",
            }}
          >
            <p style={{ color: "var(--rp-text-muted)" }}>
              No active alerts{severity ? ` with severity "${severity}"` : ""}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
