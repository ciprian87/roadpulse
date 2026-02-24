"use client";

import { severityToColor } from "@/lib/utils/severity";
import { nwsEventLabel } from "@/lib/utils/nws-event-labels";
import type { RouteHazard } from "@/lib/types/route";

// Explicit palette — consistent with HazardDetailPanel approach to avoid CSS
// variable cascade issues in contexts that may sit near the Leaflet DOM.
const DARK = {
  section: "#1a1a24",
  border: "#2a2a38",
  heading: "#f0f0f5",
  label: "#6a6a8a",
  selectedBorder: "#4096ff",
};

const LIGHT = {
  section: "#f4f4f8",
  border: "#dcdce8",
  heading: "#0f0f1a",
  label: "#7070a0",
  selectedBorder: "#4096ff",
};

interface HazardCardProps {
  hazard: RouteHazard;
  isSelected: boolean;
  onClick: () => void;
  darkMode: boolean;
}

export function HazardCard({ hazard, isSelected, onClick, darkMode }: HazardCardProps) {
  const t = darkMode ? DARK : LIGHT;
  const color = severityToColor(hazard.severity);

  // Weather alerts: show the plain-English condition as the title ("Fire Danger",
  // "Winter Storm"…) and the original NWS event type as the subtitle so experts
  // can still read it. Road events keep their existing type label.
  const title =
    hazard.kind === "weather_alert"
      ? nwsEventLabel(hazard.event)
      : hazard.title;

  const typeLabel =
    hazard.kind === "road_event"
      ? hazard.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : hazard.event;

  const positionPct = Math.round(hazard.positionAlongRoute * 100);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg overflow-hidden transition-opacity hover:opacity-90 active:opacity-75"
      style={{
        backgroundColor: t.section,
        borderTop: `1px solid ${isSelected ? t.selectedBorder : t.border}`,
        borderRight: `1px solid ${isSelected ? t.selectedBorder : t.border}`,
        borderBottom: `1px solid ${isSelected ? t.selectedBorder : t.border}`,
        borderLeft: `3px solid ${color}`,
        minHeight: "44px",
        outline: "none",
      }}
      aria-pressed={isSelected}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Severity dot */}
        <span
          className="flex-none rounded-full"
          style={{ width: "8px", height: "8px", backgroundColor: color }}
        />

        {/* Title + type/position */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug truncate" style={{ color: t.heading }}>
            {title}
          </p>
          <p className="text-xs truncate" style={{ color: t.label }}>
            {typeLabel} · {positionPct}% along route
          </p>
        </div>

        {/* Severity chip */}
        <span
          className="flex-none text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${color}22`,
            color: color,
            border: `1px solid ${color}44`,
          }}
        >
          {hazard.severity}
        </span>
      </div>
    </button>
  );
}
