"use client";

import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { useMapStore } from "@/stores/map-store";

/**
 * Keeps the map-store zoom value in sync with the live Leaflet map.
 * Must be rendered inside a LeafletMapContainer.
 */
export function ZoomTracker() {
  const map = useMap();
  const setZoom = useMapStore((s) => s.setZoom);

  // Seed the store with the actual initial zoom on mount
  useEffect(() => {
    setZoom(Math.round(map.getZoom()));
  }, [map, setZoom]);

  useMapEvents({
    zoomend: () => setZoom(Math.round(map.getZoom())),
  });

  return null;
}

/**
 * Overlay badge that displays the current zoom level.
 * Rendered outside the Leaflet DOM so it can sit freely above the map.
 */
export function ZoomBadge() {
  const zoom = useMapStore((s) => s.zoom);
  const darkMode = useMapStore((s) => s.darkMode);

  const bg     = darkMode ? "rgba(17, 17, 24, 0.85)"   : "rgba(255, 255, 255, 0.92)";
  const border = darkMode ? "rgba(255,255,255,0.08)"    : "rgba(0,0,0,0.09)";
  const label  = darkMode ? "#6a6a8a"                   : "#9090b0";
  const value  = darkMode ? "#e0e0f0"                   : "#2e2e42";

  return (
    <div
      style={{
        position: "absolute",
        // Sits above the Leaflet attribution bar (~20px) in the bottom-right corner
        bottom: "2rem",
        right: "1rem",
        zIndex: 1000,
        pointerEvents: "none",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "8px",
        padding: "4px 10px",
        display: "flex",
        alignItems: "baseline",
        gap: "5px",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: label,
        }}
      >
        Zoom
      </span>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 700,
          fontFamily: "monospace",
          color: value,
        }}
      >
        {zoom}
      </span>
    </div>
  );
}
