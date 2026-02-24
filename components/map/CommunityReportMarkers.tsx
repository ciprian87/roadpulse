"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useMapStore } from "@/stores/map-store";
import { severityToColor } from "@/lib/utils/severity";
import type { CommunityReportApiItem } from "@/lib/types/community";

// Only show community report markers at zoom 9+; they're Points and would
// overwhelm the map at regional zoom levels.
const MIN_ZOOM = 9;

interface Props {
  reports: CommunityReportApiItem[];
  onReportsChange: (reports: CommunityReportApiItem[]) => void;
}

/** Diamond-shaped DivIcon — visually distinct from road event circles */
function createDiamondIcon(severity: string): L.DivIcon {
  const color = severityToColor(severity);
  const size = 22;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;
      background-color:${color};
      border:2px solid rgba(255,255,255,0.85);
      box-shadow:0 2px 6px rgba(0,0,0,0.45);
      transform:rotate(45deg);
      border-radius:3px;
    "></div>`,
    iconSize: [size, size],
    // Anchor at center of the rotated square
    iconAnchor: [size / 2, size / 2],
  });
}

export function CommunityReportMarkers({ reports, onReportsChange }: Props) {
  const map = useMap();
  const selectCommunityReport = useMapStore((s) => s.selectCommunityReport);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportsRef = useRef<CommunityReportApiItem[]>(reports);
  reportsRef.current = reports;

  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    markerGroupRef.current = group;
    return () => { group.remove(); };
  }, [map]);

  // Re-render markers when reports change
  useEffect(() => {
    const group = markerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    for (const report of reports) {
      const [lng, lat] = report.geometry.coordinates;
      if (lng === undefined || lat === undefined) continue;

      const icon = createDiamondIcon(report.severity);
      const marker = L.marker([lat, lng], { icon });
      marker.on("click", () => selectCommunityReport(report));
      // Tooltip shows title on hover
      marker.bindTooltip(report.title, { permanent: false, direction: "top", offset: [0, -12] });
      group.addLayer(marker);
    }
  }, [reports, selectCommunityReport]);

  function fetchReports() {
    if (map.getZoom() < MIN_ZOOM) {
      // Below threshold: clear markers but don't fetch
      markerGroupRef.current?.clearLayers();
      onReportsChange([]);
      return;
    }

    const bounds = map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ].join(",");

    fetch(`/api/reports?bbox=${bbox}&limit=200`)
      .then((r) => r.json())
      .then((data: { reports: CommunityReportApiItem[] }) => {
        onReportsChange(data.reports ?? []);
      })
      .catch(() => {
        // Non-fatal: keep current markers
      });
  }

  function scheduleFetch() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(fetchReports, 400);
  }

  useEffect(() => {
    fetchReports();
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMapEvents({ moveend: scheduleFetch });

  return null;
}
