"use client";

import { useMapStore } from "@/stores/map-store";
import { SEVERITY_COLOR } from "@/lib/utils/severity";

const DARK = {
  bg: "rgba(17, 17, 24, 0.85)",
  border: "rgba(255,255,255,0.08)",
  heading: "#6a6a8a",
  label: "#c0c0d0",
};
const LIGHT = {
  bg: "rgba(255, 255, 255, 0.92)",
  border: "rgba(0,0,0,0.09)",
  heading: "#9090b0",
  label: "#2e2e42",
};

const ENTRIES = [
  { label: "Extreme",  color: SEVERITY_COLOR.Extreme },
  { label: "Severe",   color: SEVERITY_COLOR.Severe },
  { label: "Moderate", color: SEVERITY_COLOR.Moderate },
  { label: "Minor",    color: SEVERITY_COLOR.Minor },
] as const;

export function MapLegend() {
  const darkMode = useMapStore((s) => s.darkMode);
  const t = darkMode ? DARK : LIGHT;

  return (
    <div
      style={{
        position: "absolute",
        // Top-left, offset below the Leaflet zoom controls (~72px tall + 10px margin)
        top: "90px",
        left: "1rem",
        zIndex: 1000,
        pointerEvents: "none",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "10px",
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        minWidth: "110px",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: t.heading,
          marginBottom: "2px",
        }}
      >
        Severity
      </span>
      {ENTRIES.map(({ label, color }) => (
        <div
          key={label}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "2px",
              background: color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "12px", color: t.label }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
