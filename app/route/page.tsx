"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMapStore } from "@/stores/map-store";
import { useRouteStore } from "@/stores/route-store";
import { RouteInput } from "@/components/route/RouteInput";
import { RouteSummary } from "@/components/route/RouteSummary";
import { HazardList } from "@/components/route/HazardList";
import { BottomSheet } from "@/components/shared/BottomSheet";
import type { RouteHazard } from "@/lib/types/route";
import type { WeatherAlertApiItem } from "@/lib/types/weather";
import type { RoadEventApiItem } from "@/lib/types/road-event";

// Same pattern as app/page.tsx — Leaflet requires browser DOM
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

/** Returns a [lat, lng] centroid for any GeoJSON geometry type. */
function geometryCentroid(geom: GeoJSON.Geometry): [number, number] | null {
  switch (geom.type) {
    case "Point":
      return [geom.coordinates[1]!, geom.coordinates[0]!];
    case "LineString": {
      const mid = geom.coordinates[Math.floor(geom.coordinates.length / 2)];
      return mid ? [mid[1]!, mid[0]!] : null;
    }
    case "MultiLineString": {
      const c = geom.coordinates[0]?.[0];
      return c ? [c[1]!, c[0]!] : null;
    }
    case "Polygon": {
      const ring = geom.coordinates[0];
      if (!ring?.length) return null;
      const lat = ring.reduce((s, c) => s + c[1]!, 0) / ring.length;
      const lng = ring.reduce((s, c) => s + c[0]!, 0) / ring.length;
      return [lat, lng];
    }
    case "MultiPolygon": {
      const ring = geom.coordinates[0]?.[0];
      if (!ring?.length) return null;
      const lat = ring.reduce((s, c) => s + c[1]!, 0) / ring.length;
      const lng = ring.reduce((s, c) => s + c[0]!, 0) / ring.length;
      return [lat, lng];
    }
    default:
      return null;
  }
}

const DARK = {
  bg: "#111118",
  border: "#2a2a38",
  handle: "#2a2a38",
  section: "#1a1a24",
};
const LIGHT = {
  bg: "#ffffff",
  border: "#dcdce8",
  handle: "#d0d0e0",
  section: "#f4f4f8",
};

export default function RoutePage() {
  const darkMode = useMapStore((s) => s.darkMode);
  const selectEvent = useMapStore((s) => s.selectEvent);
  const selectAlert = useMapStore((s) => s.selectAlert);

  const result = useRouteStore((s) => s.result);
  const selectedHazard = useRouteStore((s) => s.selectedHazard);
  const setSelectedHazard = useRouteStore((s) => s.setSelectedHazard);
  const setFlyToTarget = useRouteStore((s) => s.setFlyToTarget);

  // Mobile bottom sheet open state — opens when a hazard is tapped
  const [sheetSnap, setSheetSnap] = useState<"peek" | "half" | "full">("peek");

  const t = darkMode ? DARK : LIGHT;

  function handleSelectHazard(hazard: RouteHazard) {
    setSelectedHazard(hazard);

    // Pan the map to the hazard location
    const centroid = geometryCentroid(hazard.geometry);
    if (centroid) setFlyToTarget(centroid);

    // Bridge into map store so the existing HazardDetailPanel opens with full detail UI
    if (hazard.kind === "road_event") {
      selectEvent({
        id: hazard.id,
        source_event_id: hazard.id,
        severity: hazard.severity,
        title: hazard.title,
        type: hazard.type,
        direction: hazard.direction,
        route_name: hazard.routeName,
        description: hazard.description,
        expected_end_at: hazard.expectedEndAt,
        lane_impact: hazard.laneImpact as RoadEventApiItem["lane_impact"],
        vehicle_restrictions: hazard.vehicleRestrictions as RoadEventApiItem["vehicle_restrictions"],
        source: hazard.source,
        state: hazard.state,
        geometry: hazard.geometry,
        location_description: null,
        started_at: null,
        last_updated_at: null,
        detour_description: null,
        source_feed_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      } satisfies RoadEventApiItem);
    } else {
      selectAlert({
        id: hazard.id,
        nws_id: hazard.id,
        severity: hazard.severity,
        event: hazard.event,
        headline: hazard.headline,
        description: hazard.description,
        instruction: hazard.instruction,
        expires: hazard.expires,
        area_description: hazard.areaDescription,
        geometry: hazard.geometry,
        is_active: true,
        created_at: new Date().toISOString(),
        urgency: null,
        certainty: null,
        affected_zones: [],
        onset: null,
        last_updated_at: null,
        sender_name: null,
        wind_speed: null,
        snow_amount: null,
      } satisfies WeatherAlertApiItem);
    }
  }

  const resultPanel = result ? (
    <>
      <RouteSummary route={result.route} summary={result.summary} darkMode={darkMode} />
      <HazardList
        hazards={result.hazards}
        selectedHazardId={selectedHazard?.id ?? null}
        onSelectHazard={handleSelectHazard}
        darkMode={darkMode}
      />
    </>
  ) : null;

  return (
    <div className="w-full h-full flex">
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <div
        className="hidden md:flex flex-col w-[400px] flex-none h-full overflow-hidden"
        style={{ backgroundColor: t.bg, borderRight: `1px solid ${t.border}` }}
      >
        <RouteInput darkMode={darkMode} />
        {result && <div className="flex-1 overflow-y-auto">{resultPanel}</div>}
      </div>

      {/* ── Map area ────────────────────────────────────────────── */}
      <div className="flex-1 relative h-full">
        <MapView />

        {/* Mobile: RouteInput floats above the map */}
        <div
          className="md:hidden absolute top-0 left-0 right-0 z-[1000] px-3 pt-3"
          style={{ pointerEvents: "auto" }}
        >
          <div
            className="rounded-xl shadow-lg overflow-hidden"
            style={{ backgroundColor: t.bg, border: `1px solid ${t.border}` }}
          >
            <RouteInput darkMode={darkMode} />
          </div>
        </div>
      </div>

      {/* ── Mobile bottom sheet for route results ───────────────── */}
      {result && (
        // Non-dismissible: onClose is a no-op so swiping down from peek keeps it open.
        // The sheet starts at "peek" (80px) and the user swipes up for half/full.
        <BottomSheet
          key={result.checkedAt}
          open={true}
          onClose={() => setSheetSnap("peek")}
          initialSnap={sheetSnap}
          backgroundColor={t.bg}
          borderColor={t.border}
          handleColor={t.handle}
        >
          {resultPanel}
        </BottomSheet>
      )}
    </div>
  );
}
