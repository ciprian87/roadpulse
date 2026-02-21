"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapEvents, Polygon } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { WeatherAlertApiItem } from "@/lib/types/weather";
import { severityToColor } from "@/lib/utils/severity";
import { useMapStore } from "@/stores/map-store";
import { EVENT_TO_CATEGORY } from "@/lib/utils/alert-categories";

interface Props {
  alerts: WeatherAlertApiItem[];
  onAlertsChange: (alerts: WeatherAlertApiItem[]) => void;
}

/** Convert GeoJSON coordinates to Leaflet LatLngExpression arrays.
 *  GeoJSON uses [lng, lat]; Leaflet uses [lat, lng]. */
function geoJsonRingToLatLng(ring: number[][]): LatLngExpression[] {
  return ring.map(([lng, lat]) => [lat, lng]);
}

function renderPolygonGeometry(
  geometry: GeoJSON.Geometry,
  color: string,
  onCentroidClick: () => void,
  key: string
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];

  if (geometry.type === "Polygon") {
    const positions = geometry.coordinates.map(geoJsonRingToLatLng) as LatLngExpression[][];
    nodes.push(
      <Polygon
        key={`${key}-poly`}
        positions={positions}
        pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 1.5 }}
        eventHandlers={{ click: onCentroidClick }}
      />
    );
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon, pi) => {
      const positions = polygon.map(geoJsonRingToLatLng) as LatLngExpression[][];
      nodes.push(
        <Polygon
          key={`${key}-poly-${pi}`}
          positions={positions}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 1.5 }}
          eventHandlers={{ click: onCentroidClick }}
        />
      );
    });
  }

  return nodes;
}

/** Inner component that lives inside <MapContainer> and drives bbox-based fetching */
export function WeatherAlertMarkers({ alerts, onAlertsChange }: Props) {
  const map = useMap();
  const selectAlert = useMapStore((s) => s.selectAlert);
  const visibleCategories = useMapStore((s) => s.visibleCategories);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fetchAlerts() {
    const bounds = map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ].join(",");
    const zoom = Math.round(map.getZoom());

    fetch(`/api/weather/alerts?bbox=${bbox}&active_only=true&zoom=${zoom}`)
      .then((r) => r.json())
      .then((data: { alerts: WeatherAlertApiItem[] }) => {
        onAlertsChange(data.alerts ?? []);
      })
      .catch(() => {
        // Fetch failures are non-fatal; current alerts remain visible
      });
  }

  function scheduleFetch() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(fetchAlerts, 400);
  }

  // Fetch on first mount and on map move
  useEffect(() => {
    fetchAlerts();
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMapEvents({ moveend: scheduleFetch });

  return (
    <>
      {alerts.map((alert) => {
        if (!alert.geometry) return null;

        // Filter by active category. Events not in any category are always shown (fail-open).
        const categoryKey = EVENT_TO_CATEGORY[alert.event];
        if (categoryKey !== undefined && !visibleCategories[categoryKey]) return null;

        const color = severityToColor(alert.severity);
        return renderPolygonGeometry(
          alert.geometry,
          color,
          () => selectAlert(alert),
          alert.id
        );
      })}
    </>
  );
}
