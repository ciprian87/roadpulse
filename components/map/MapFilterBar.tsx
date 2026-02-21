"use client";

import { useState } from "react";
import { useMapStore } from "@/stores/map-store";
import { ALERT_CATEGORIES, ROAD_EVENT_CATEGORIES } from "@/lib/utils/alert-categories";

const DARK = {
  panelBg:      "rgba(15, 15, 22, 0.92)",
  panelBorder:  "rgba(255,255,255,0.09)",
  labelColor:   "rgba(255,255,255,0.32)",
  divider:      "rgba(255,255,255,0.07)",
  chipActiveBg: "rgba(255,255,255,0.07)",
  chipActiveText: "#f0f0f5",
  chipInactiveText: "rgba(255,255,255,0.28)",
  btnBg:        "rgba(15, 15, 22, 0.88)",
  btnBorder:    "rgba(255,255,255,0.10)",
  btnColor:     "#9090b0",
  btnActiveDot: "#f0f0f5",
};
const LIGHT = {
  panelBg:      "rgba(255, 255, 255, 0.94)",
  panelBorder:  "rgba(0,0,0,0.08)",
  labelColor:   "rgba(0,0,0,0.35)",
  divider:      "rgba(0,0,0,0.06)",
  chipActiveBg: "rgba(0,0,0,0.05)",
  chipActiveText: "#0f0f1a",
  chipInactiveText: "rgba(0,0,0,0.25)",
  btnBg:        "rgba(255, 255, 255, 0.92)",
  btnBorder:    "rgba(0,0,0,0.10)",
  btnColor:     "#7070a0",
  btnActiveDot: "#0f0f1a",
};

// ── Lucide SlidersHorizontal icon ─────────────────────────────────────────────
function SlidersIcon({ color }: { color: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16" height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="21" x2="14" y1="4" y2="4" />
      <line x1="10" x2="3"  y1="4" y2="4" />
      <line x1="21" x2="12" y1="12" y2="12" />
      <line x1="8"  x2="3"  y1="12" y2="12" />
      <line x1="21" x2="16" y1="20" y2="20" />
      <line x1="12" x2="3"  y1="20" y2="20" />
      <line x1="14" x2="14" y1="2"  y2="6" />
      <line x1="8"  x2="8"  y1="10" y2="14" />
      <line x1="16" x2="16" y1="18" y2="22" />
    </svg>
  );
}

// ── Category chip ─────────────────────────────────────────────────────────────
function Chip({
  label,
  color,
  active,
  onClick,
  t,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  t: typeof DARK;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        height: "26px",
        padding: "0 10px 0 8px",
        borderRadius: "6px",
        border: "none",
        cursor: "pointer",
        background: active ? t.chipActiveBg : "transparent",
        color: active ? t.chipActiveText : t.chipInactiveText,
        fontSize: "11.5px",
        fontWeight: active ? 500 : 400,
        letterSpacing: "0.01em",
        transition: "background 0.15s, color 0.15s, opacity 0.15s",
        flexShrink: 0,
      }}
    >
      {/* Color indicator dot */}
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          opacity: active ? 1 : 0.35,
          transition: "opacity 0.15s",
        }}
      />
      {label}
    </button>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ text, t }: { text: string; t: typeof DARK }) {
  return (
    <span
      style={{
        fontSize: "9.5px",
        fontWeight: 600,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: t.labelColor,
        paddingLeft: "2px",
        flexShrink: 0,
        alignSelf: "center",
      }}
    >
      {text}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function MapFilterBar() {
  const [open, setOpen] = useState(false);
  const darkMode = useMapStore((s) => s.darkMode);
  const visibleCategories = useMapStore((s) => s.visibleCategories);
  const toggleCategory = useMapStore((s) => s.toggleCategory);
  const visibleRoadTypes = useMapStore((s) => s.visibleRoadTypes);
  const toggleRoadType = useMapStore((s) => s.toggleRoadType);

  const t = darkMode ? DARK : LIGHT;

  // Count how many filter groups have at least one hidden category — shown as a badge
  const hiddenCount =
    ALERT_CATEGORIES.filter((c) => !visibleCategories[c.key]).length +
    ROAD_EVENT_CATEGORIES.filter((c) => !visibleRoadTypes[c.key]).length;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "1rem",
        right: "1rem",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "8px",
        pointerEvents: "none",
      }}
    >
      {/* ── Expanded filter panel ──────────────────────────────────────── */}
      {open && (
        <div
          style={{
            pointerEvents: "auto",
            background: t.panelBg,
            border: `1px solid ${t.panelBorder}`,
            borderRadius: "14px",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            padding: "12px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxWidth: "310px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.28)",
          }}
        >
          {/* NWS Weather section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <SectionLabel text="NWS Weather" t={t} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
              {ALERT_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.key}
                  label={cat.label}
                  color={cat.color}
                  active={visibleCategories[cat.key] ?? true}
                  onClick={() => toggleCategory(cat.key)}
                  t={t}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: t.divider, margin: "0 2px" }} />

          {/* 511 Roads section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <SectionLabel text="511 Roads" t={t} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
              {ROAD_EVENT_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.key}
                  label={cat.label}
                  color={cat.color}
                  active={visibleRoadTypes[cat.key] ?? true}
                  onClick={() => toggleRoadType(cat.key)}
                  t={t}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Filter toggle button ───────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          pointerEvents: "auto",
          width: "38px",
          height: "38px",
          borderRadius: "10px",
          background: t.btnBg,
          border: `1px solid ${open ? "rgba(255,255,255,0.18)" : t.btnBorder}`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: open
            ? "0 2px 12px rgba(0,0,0,0.3)"
            : "0 1px 6px rgba(0,0,0,0.18)",
          position: "relative",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
        aria-label={open ? "Close filters" : "Open filters"}
        aria-expanded={open}
      >
        <SlidersIcon color={open ? t.btnActiveDot : t.btnColor} />

        {/* Badge: number of hidden filter groups */}
        {hiddenCount > 0 && !open && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "#ff4d4f",
              color: "white",
              fontSize: "9px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {hiddenCount}
          </span>
        )}
      </button>
    </div>
  );
}
