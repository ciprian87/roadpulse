"use client";

import dynamic from "next/dynamic";

// Leaflet requires the browser DOM — disable SSR for the entire map view
const MapView = dynamic(() => import("@/components/map/MapContainer"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ backgroundColor: "var(--rp-bg)" }}
    >
      <p style={{ color: "var(--rp-text-muted)" }}>Loading map…</p>
    </div>
  ),
});

export default function MapPage() {
  return (
    // h-full works because AppShell gives the main area flex-1 min-h-0
    <div className="w-full h-full">
      <MapView />
    </div>
  );
}
