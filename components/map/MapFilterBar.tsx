"use client";

import { useMapStore } from "@/stores/map-store";
import { ALERT_CATEGORIES } from "@/lib/utils/alert-categories";

// Theme-explicit colors so we don't depend on CSS vars inside Leaflet's DOM context.
const DARK = {
  bg: "rgba(17, 17, 24, 0.85)",
  activeBg: "rgba(255,255,255,0.12)",
  activeText: "#f0f0f5",
  activeBorder: "rgba(255,255,255,0.25)",
  inactiveText: "#6a6a8a",
  inactiveBorder: "rgba(255,255,255,0.06)",
};
const LIGHT = {
  bg: "rgba(255, 255, 255, 0.92)",
  activeBg: "rgba(0,0,0,0.08)",
  activeText: "#0f0f1a",
  activeBorder: "rgba(0,0,0,0.25)",
  inactiveText: "#a0a0b8",
  inactiveBorder: "rgba(0,0,0,0.07)",
};

export function MapFilterBar() {
  const darkMode = useMapStore((s) => s.darkMode);
  const visibleCategories = useMapStore((s) => s.visibleCategories);
  const toggleCategory = useMapStore((s) => s.toggleCategory);
  const resetCategories = useMapStore((s) => s.resetCategories);

  const t = darkMode ? DARK : LIGHT;

  const allVisible = ALERT_CATEGORIES.every((c) => visibleCategories[c.key]);

  const chipBase: React.CSSProperties = {
    flexShrink: 0,
    height: "32px",
    padding: "0 14px",
    borderRadius: "16px",
    fontSize: "12px",
    cursor: "pointer",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    transition: "background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s",
    letterSpacing: "0.03em",
  };

  return (
    // Outer div fills the full map width but passes pointer events through to the map.
    // Only the chips themselves capture clicks.
    <div
      style={{
        position: "absolute",
        bottom: "1rem",
        left: "1rem",
        right: "1rem",
        zIndex: 1000,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "6px",
          overflowX: "auto",
          pointerEvents: "auto",
          padding: "4px 2px",
          scrollbarWidth: "none",
        }}
      >
        {/* ALL / reset chip */}
        <button
          onClick={resetCategories}
          style={{
            ...chipBase,
            border: `1px solid ${allVisible ? t.activeBorder : t.inactiveBorder}`,
            background: allVisible ? t.activeBg : t.bg,
            color: allVisible ? t.activeText : t.inactiveText,
            fontWeight: allVisible ? 700 : 400,
          }}
        >
          ALL
        </button>

        {ALERT_CATEGORIES.map((cat) => {
          const active = visibleCategories[cat.key] ?? true;
          return (
            <button
              key={cat.key}
              onClick={() => toggleCategory(cat.key)}
              style={{
                ...chipBase,
                border: `1px solid ${active ? t.activeBorder : t.inactiveBorder}`,
                background: active ? t.activeBg : t.bg,
                color: active ? t.activeText : t.inactiveText,
                fontWeight: active ? 600 : 400,
                opacity: active ? 1 : 0.6,
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
