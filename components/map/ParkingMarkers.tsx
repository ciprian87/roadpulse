"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useMapStore } from "@/stores/map-store";
import type { ParkingFacilityApiItem } from "@/lib/types/parking";

// Only show parking markers at zoom 8+; at lower zooms facilities are too dense
// and not useful at a regional planning level.
const MIN_ZOOM = 8;

interface Props {
  facilities: ParkingFacilityApiItem[];
  onFacilitiesChange: (facilities: ParkingFacilityApiItem[]) => void;
}

/** Color-coded by availability ratio */
function availabilityColor(available: number | null, total: number | null): string {
  if (available === null || total === null || total === 0) return "#4096ff"; // blue = unknown
  const ratio = available / total;
  if (ratio > 0.5) return "#36cfc9"; // green: >50% available
  if (ratio >= 0.25) return "#ffd000"; // yellow: 25–50%
  return "#ff4d4f"; // red: <25%
}

/** Square "P" DivIcon with available count badge */
function createParkingIcon(available: number | null, total: number | null): L.DivIcon {
  const color = availabilityColor(available, total);
  const badge = available !== null ? String(available) : "?";
  return L.divIcon({
    className: "",
    html: `<div style="
      position:relative;
      width:28px;height:28px;
      background-color:${color};
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 6px rgba(0,0,0,0.5);
      border-radius:4px;
      display:flex;align-items:center;justify-content:center;
      color:#0c0f14;font-weight:800;font-size:13px;font-family:sans-serif;
    ">P<span style="
      position:absolute;top:-6px;right:-6px;
      background:#0c0f14;color:${color};
      font-size:9px;font-weight:700;font-family:sans-serif;
      padding:1px 3px;border-radius:4px;line-height:1.4;
      border:1px solid ${color};
    ">${badge}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function ParkingMarkers({ facilities, onFacilitiesChange }: Props) {
  const map = useMap();
  const selectParking = useMapStore((s) => s.selectParking);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    markerGroupRef.current = group;
    return () => { group.remove(); };
  }, [map]);

  useEffect(() => {
    const group = markerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    for (const facility of facilities) {
      const [lng, lat] = facility.geometry.coordinates;
      if (lng === undefined || lat === undefined) continue;

      const icon = createParkingIcon(facility.available_spaces, facility.total_spaces);
      const marker = L.marker([lat, lng], { icon });
      marker.on("click", () => selectParking(facility));
      const tip = facility.highway
        ? `${facility.name} · ${facility.highway}`
        : facility.name;
      marker.bindTooltip(tip, { permanent: false, direction: "top", offset: [0, -14] });
      group.addLayer(marker);
    }
  }, [facilities, selectParking]);

  function fetchFacilities() {
    if (map.getZoom() < MIN_ZOOM) {
      markerGroupRef.current?.clearLayers();
      onFacilitiesChange([]);
      return;
    }

    const bounds = map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ].join(",");

    fetch(`/api/parking?bbox=${bbox}&limit=200`)
      .then((r) => r.json())
      .then((data: { facilities: ParkingFacilityApiItem[] }) => {
        onFacilitiesChange(data.facilities ?? []);
      })
      .catch(() => {
        // Non-fatal: keep current markers
      });
  }

  function scheduleFetch() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(fetchFacilities, 400);
  }

  useEffect(() => {
    fetchFacilities();
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMapEvents({ moveend: scheduleFetch });

  return null;
}
