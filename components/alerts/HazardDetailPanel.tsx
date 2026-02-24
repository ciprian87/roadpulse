"use client";

import { useMapStore } from "@/stores/map-store";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { severityLabel, severityToColor } from "@/lib/utils/severity";
import type { WeatherAlertApiItem } from "@/lib/types/weather";
import type { RoadEventApiItem } from "@/lib/types/road-event";
import type { CommunityReportApiItem } from "@/lib/types/community";
import { REPORT_TYPE_LABELS } from "@/lib/types/community";

// Explicit theme palettes — avoids CSS variable cascade issues inside the
// Leaflet map container where [data-theme="light"] on <html> doesn't always
// propagate to inline styles reliably.
const DARK = {
  bg: "#111118",
  section: "#1a1a24",
  border: "#2a2a38",
  heading: "#f0f0f5",
  body: "#c0c0d0",
  label: "#6a6a8a",
  handle: "#2a2a38",
};

const LIGHT = {
  bg: "#ffffff",
  section: "#f4f4f8",
  border: "#dcdce8",
  heading: "#0f0f1a",
  body: "#2e2e42",
  label: "#7070a0",
  handle: "#d0d0e0",
};

function relativeExpiry(isoString: string | null): { text: string; expired: boolean } {
  if (!isoString) return { text: "No expiry", expired: false };
  const date = new Date(isoString);
  const diffMs = date.getTime() - Date.now();
  const diffH = Math.round(diffMs / 3_600_000);
  const diffM = Math.round(diffMs / 60_000);

  if (diffMs < 0) {
    const agoH = Math.abs(diffH);
    const text =
      agoH < 1
        ? `Expired ${Math.abs(diffM)}m ago`
        : agoH < 24
          ? `Expired ${agoH}h ago`
          : `Expired ${Math.round(agoH / 24)}d ago`;
    return { text, expired: true };
  }
  const text =
    diffH < 1
      ? `Expires in ${diffM}m`
      : diffH < 24
        ? `Expires in ${diffH}h`
        : `Expires ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return { text, expired: false };
}

function formatDateTime(isoString: string | null): string | null {
  if (!isoString) return null;
  return new Date(isoString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface SectionProps {
  label: string;
  children: React.ReactNode;
  accentColor: string;
  t: typeof DARK;
}

function Section({ label, children, accentColor, t }: SectionProps) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: t.section, border: `1px solid ${t.border}` }}
    >
      {/* Colored left accent bar + label */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <span
          className="w-1 h-4 rounded-full flex-none"
          style={{ backgroundColor: accentColor }}
        />
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: t.label }}
        >
          {label}
        </span>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

function MetricChip({
  label,
  value,
  color,
  t,
}: {
  label: string;
  value: string;
  color: string;
  t: typeof DARK;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ backgroundColor: t.section, border: `1px solid ${t.border}` }}
    >
      <span
        className="w-1 h-full rounded-full"
        style={{ backgroundColor: color, minHeight: "16px", width: "3px" }}
      />
      <div>
        <p className="text-xs" style={{ color: t.label }}>
          {label}
        </p>
        <p className="text-sm font-medium" style={{ color: t.heading }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Weather alert content (mirrors AlertDetailPanel.tsx AlertContent exactly) ──

function WeatherContent({ alert, t }: { alert: WeatherAlertApiItem; t: typeof DARK }) {
  const clearSelection = useMapStore((s) => s.clearSelection);
  const severityColor = severityToColor(alert.severity);
  const label = severityLabel(alert.severity);
  const { text: expiryText, expired: isExpired } = relativeExpiry(alert.expires);

  return (
    <div style={{ backgroundColor: t.bg }}>
      {/* ── Severity banner ────────────────────────────────────── */}
      <div
        className="px-4 pt-4 pb-3"
        style={{
          borderBottom: `1px solid ${t.border}`,
          background: `linear-gradient(135deg, ${severityColor}18 0%, ${severityColor}06 100%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            {/* Severity pill + event type */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: `${severityColor}22`,
                  color: severityColor,
                  border: `1px solid ${severityColor}55`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: severityColor }}
                />
                {label}
              </span>
              <span className="text-xs font-medium" style={{ color: t.label }}>
                {alert.event}
              </span>
            </div>

            {/* Headline */}
            <p className="text-sm font-semibold leading-snug" style={{ color: t.heading }}>
              {alert.headline ?? alert.event}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={clearSelection}
            className="flex-none flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{
              width: "32px",
              height: "32px",
              minWidth: "32px",
              color: t.label,
              backgroundColor: t.section,
              border: `1px solid ${t.border}`,
            }}
            aria-label="Close alert detail"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Timing row */}
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          <span
            className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded"
            style={{
              backgroundColor: isExpired ? "#ff4d4f22" : `${severityColor}18`,
              color: isExpired ? "#ff4d4f" : severityColor,
            }}
          >
            {expiryText}
          </span>

          {alert.onset && (
            <span className="text-xs" style={{ color: t.label }}>
              Onset:{" "}
              {new Date(alert.onset).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* ── Content sections ───────────────────────────────────── */}
      <div className="px-4 py-4 space-y-3">
        {/* Area */}
        <Section label="Affected Area" accentColor={severityColor} t={t}>
          <p className="text-sm leading-relaxed" style={{ color: t.body }}>
            {alert.area_description}
          </p>
        </Section>

        {/* Description */}
        {alert.description && (
          <Section label="Description" accentColor="#4096ff" t={t}>
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: t.body }}
            >
              {alert.description}
            </p>
          </Section>
        )}

        {/* Instructions */}
        {alert.instruction && (
          <Section label="What to Do" accentColor="#36cfc9" t={t}>
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: t.body }}
            >
              {alert.instruction}
            </p>
          </Section>
        )}

        {/* Weather metrics chips */}
        {(alert.wind_speed ?? alert.snow_amount) && (
          <div className="flex gap-2 flex-wrap">
            {alert.wind_speed && (
              <MetricChip label="Wind" value={alert.wind_speed} color="#4096ff" t={t} />
            )}
            {alert.snow_amount && (
              <MetricChip label="Snow" value={alert.snow_amount} color="#36cfc9" t={t} />
            )}
          </div>
        )}

        {/* Issuer */}
        {alert.sender_name && (
          <p className="text-xs pb-2" style={{ color: t.label }}>
            Issued by {alert.sender_name}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Road event content ─────────────────────────────────────────────────────────

function RoadEventContent({ event, t }: { event: RoadEventApiItem; t: typeof DARK }) {
  const clearSelection = useMapStore((s) => s.clearSelection);
  const severityColor = severityToColor(event.severity);
  const { text: endText, expired: isExpired } = relativeExpiry(event.expected_end_at);

  // Human-readable type label
  const typeLabel = event.type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{ backgroundColor: t.bg }}>
      {/* ── Severity banner ────────────────────────────────────── */}
      <div
        className="px-4 pt-4 pb-3"
        style={{
          borderBottom: `1px solid ${t.border}`,
          background: `linear-gradient(135deg, ${severityColor}18 0%, ${severityColor}06 100%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            {/* Severity pill + type */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: `${severityColor}22`,
                  color: severityColor,
                  border: `1px solid ${severityColor}55`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: severityColor }}
                />
                {event.severity}
              </span>
              <span className="text-xs font-medium" style={{ color: t.label }}>
                {typeLabel}
              </span>
            </div>

            {/* Title */}
            <p className="text-sm font-semibold leading-snug" style={{ color: t.heading }}>
              {event.title}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={clearSelection}
            className="flex-none flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{
              width: "32px",
              height: "32px",
              minWidth: "32px",
              color: t.label,
              backgroundColor: t.section,
              border: `1px solid ${t.border}`,
            }}
            aria-label="Close event detail"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Route + direction row */}
        {(event.route_name ?? event.direction) && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {event.route_name && (
              <span className="text-xs font-medium" style={{ color: t.heading }}>
                {event.route_name}
              </span>
            )}
            {event.direction && (
              <span className="text-xs" style={{ color: t.label }}>
                {event.direction}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Content sections ───────────────────────────────────── */}
      <div className="px-4 py-4 space-y-3">
        {/* Timeline */}
        <Section label="Timeline" accentColor={severityColor} t={t}>
          <div className="space-y-1.5">
            {event.started_at && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: t.label }}>
                  Started
                </span>
                <span className="text-xs font-medium" style={{ color: t.body }}>
                  {formatDateTime(event.started_at)}
                </span>
              </div>
            )}
            {event.expected_end_at && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: t.label }}>
                  Expected end
                </span>
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded"
                  style={{
                    color: isExpired ? "#ff4d4f" : severityColor,
                    backgroundColor: isExpired ? "#ff4d4f18" : `${severityColor}18`,
                  }}
                >
                  {endText}
                </span>
              </div>
            )}
            {!event.started_at && !event.expected_end_at && (
              <p className="text-xs" style={{ color: t.label }}>
                No timing information available
              </p>
            )}
          </div>
        </Section>

        {/* Description */}
        {event.description && (
          <Section label="Description" accentColor="#4096ff" t={t}>
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: t.body }}
            >
              {event.description}
            </p>
          </Section>
        )}

        {/* Lane impact */}
        {event.lane_impact && (
          <Section label="Lane Impact" accentColor={severityColor} t={t}>
            <div className="space-y-1">
              <p className="text-sm font-medium" style={{ color: t.body }}>
                {event.lane_impact.vehicle_impact.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
              {event.lane_impact.workers_present && (
                <p className="text-xs" style={{ color: "#ffd000" }}>
                  Workers present
                </p>
              )}
            </div>
          </Section>
        )}

        {/* Vehicle restrictions */}
        {event.vehicle_restrictions.length > 0 && (
          <Section label="Restrictions" accentColor="#ff8c00" t={t}>
            <ul className="space-y-1">
              {event.vehicle_restrictions.map((r, i) => (
                <li key={i} className="text-sm" style={{ color: t.body }}>
                  {r.type}
                  {r.value !== undefined && r.unit
                    ? ` — ${r.value} ${r.unit}`
                    : ""}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Detour */}
        {event.detour_description && (
          <Section label="Detour" accentColor="#36cfc9" t={t}>
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: t.body }}
            >
              {event.detour_description}
            </p>
          </Section>
        )}

        {/* Source attribution */}
        <p className="text-xs pb-2" style={{ color: t.label }}>
          Source: {event.source}
          {event.state ? ` · ${event.state}` : ""}
        </p>
      </div>
    </div>
  );
}

// ── Community report content ────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffM = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffM / 60);
  if (diffM < 2) return "Just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function CommunityContent({ report, t }: { report: CommunityReportApiItem; t: typeof DARK }) {
  const clearSelection = useMapStore((s) => s.clearSelection);
  const severityColor = severityToColor(report.severity);
  const netVotes = report.upvotes - report.downvotes;
  const typeLabel = REPORT_TYPE_LABELS[report.type] ?? report.type;

  return (
    <div style={{ backgroundColor: t.bg }}>
      <div
        className="px-4 pt-4 pb-3"
        style={{
          borderBottom: `1px solid ${t.border}`,
          background: `linear-gradient(135deg, ${severityColor}18 0%, ${severityColor}06 100%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: `${severityColor}22`,
                  color: severityColor,
                  border: `1px solid ${severityColor}55`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: severityColor }} />
                {severityLabel(report.severity)}
              </span>
              <span className="text-xs font-medium" style={{ color: t.label }}>{typeLabel}</span>
            </div>
            <p className="text-sm font-semibold leading-snug" style={{ color: t.heading }}>
              {report.title}
            </p>
            <p className="text-xs" style={{ color: t.label }}>
              Reported by driver · {timeAgo(report.created_at)}
            </p>
          </div>
          <button
            onClick={clearSelection}
            className="flex-none flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ width: "32px", height: "32px", minWidth: "32px", color: t.label, backgroundColor: t.section, border: `1px solid ${t.border}` }}
            aria-label="Close report detail"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Vote tally */}
        <div className="flex items-center gap-3 mt-2.5">
          <span className="text-xs" style={{ color: "#36cfc9" }}>
            👍 {report.upvotes}
          </span>
          <span className="text-xs" style={{ color: t.label }}>
            👎 {report.downvotes}
          </span>
          {netVotes >= 3 && (
            <span className="text-xs font-semibold" style={{ color: "#36cfc9" }}>
              ✅ Verified by drivers
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {report.description && (
          <Section label="Details" accentColor="#4096ff" t={t}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: t.body }}>
              {report.description}
            </p>
          </Section>
        )}
        {(report.location_description ?? report.route_name) && (
          <Section label="Location" accentColor={severityColor} t={t}>
            <p className="text-sm" style={{ color: t.body }}>
              {[report.location_description, report.route_name].filter(Boolean).join(" · ")}
            </p>
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Unified panel ──────────────────────────────────────────────────────────────

/** Renders as a right-side panel on desktop and a BottomSheet on mobile */
export function HazardDetailPanel() {
  const selectedHazard = useMapStore((s) => s.selectedHazard);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const darkMode = useMapStore((s) => s.darkMode);
  const t = darkMode ? DARK : LIGHT;

  if (!selectedHazard) return null;

  // Stable key for BottomSheet — resets snap position on new selection
  const key =
    selectedHazard.kind === "weather"
      ? selectedHazard.alert.id
      : selectedHazard.kind === "road"
        ? selectedHazard.event.id
        : selectedHazard.report.id;

  const content =
    selectedHazard.kind === "weather" ? (
      <WeatherContent alert={selectedHazard.alert} t={t} />
    ) : selectedHazard.kind === "road" ? (
      <RoadEventContent event={selectedHazard.event} t={t} />
    ) : (
      <CommunityContent report={selectedHazard.report} t={t} />
    );

  return (
    <>
      {/* Desktop panel */}
      <div
        className="hidden md:flex flex-col absolute top-4 right-4 bottom-4 z-[1000] rounded-xl shadow-2xl overflow-hidden"
        style={{
          width: "400px",
          backgroundColor: t.bg,
          border: `1px solid ${t.border}`,
        }}
      >
        <div className="overflow-y-auto flex-1">{content}</div>
      </div>

      {/* Mobile bottom sheet — keyed by hazard id so snap resets on new selection */}
      <BottomSheet
        key={key}
        open={true}
        onClose={clearSelection}
        initialSnap="half"
        backgroundColor={t.bg}
        borderColor={t.border}
        handleColor={t.handle}
      >
        {content}
      </BottomSheet>
    </>
  );
}
