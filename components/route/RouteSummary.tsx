"use client";

import type { RouteCheckResponse } from "@/lib/types/route";

const DARK = {
  section: "#1a1a24",
  border: "#2a2a38",
  heading: "#f0f0f5",
  label: "#6a6a8a",
};

const LIGHT = {
  section: "#f4f4f8",
  border: "#dcdce8",
  heading: "#0f0f1a",
  label: "#7070a0",
};

const SEVERITY_COLORS = {
  critical: "#ff4d4f",
  warning: "#ff8c00",
  advisory: "#ffd000",
  info: "#4096ff",
} as const;

interface RouteSummaryProps {
  route: RouteCheckResponse["route"];
  summary: RouteCheckResponse["summary"];
  darkMode: boolean;
}

function formatDistance(meters: number): string {
  return `${(meters / 1609.344).toFixed(1)} mi`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function RouteSummary({ route, summary, darkMode }: RouteSummaryProps) {
  const t = darkMode ? DARK : LIGHT;

  const chips = [
    { label: "Critical", count: summary.criticalCount, color: SEVERITY_COLORS.critical },
    { label: "Warning", count: summary.warningCount, color: SEVERITY_COLORS.warning },
    { label: "Advisory", count: summary.advisoryCount, color: SEVERITY_COLORS.advisory },
    { label: "Info", count: summary.infoCount, color: SEVERITY_COLORS.info },
  ].filter((c) => c.count > 0);

  const hasHazards = summary.totalHazards > 0;

  return (
    <div
      className="mx-3 mb-3 rounded-xl overflow-hidden"
      style={{ backgroundColor: t.section, border: `1px solid ${t.border}` }}
    >
      {/* Distance / duration / hazard count row */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: hasHazards ? `1px solid ${t.border}` : "none" }}
      >
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs" style={{ color: t.label }}>
              Distance
            </p>
            <p className="text-base font-semibold" style={{ color: t.heading }}>
              {formatDistance(route.distanceMeters)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: t.label }}>
              Duration
            </p>
            <p className="text-base font-semibold" style={{ color: t.heading }}>
              {formatDuration(route.durationSeconds)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: t.label }}>
            Hazards
          </p>
          <p
            className="text-base font-semibold"
            style={{ color: hasHazards ? "#ff8c00" : "#36cfc9" }}
          >
            {summary.totalHazards}
          </p>
        </div>
      </div>

      {/* All-clear banner */}
      {!hasHazards && (
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{ backgroundColor: "#36cfc914" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#36cfc9"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-sm font-medium" style={{ color: "#36cfc9" }}>
            All clear — no hazards detected
          </p>
        </div>
      )}

      {/* Severity chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: `${chip.color}22`,
                color: chip.color,
                border: `1px solid ${chip.color}44`,
              }}
            >
              <span
                className="rounded-full"
                style={{ width: "6px", height: "6px", backgroundColor: chip.color }}
              />
              {chip.count} {chip.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
