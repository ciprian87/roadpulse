"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { WeatherAlertApiItem } from "@/lib/types/weather";
import { severityToColor } from "@/lib/utils/severity";
import { useMapStore } from "@/stores/map-store";
import { EVENT_TO_CATEGORY } from "@/lib/utils/alert-categories";

interface Props {
  alerts: WeatherAlertApiItem[];
  onAlertsChange: (alerts: WeatherAlertApiItem[]) => void;
}

/** Inner component that lives inside <MapContainer> and drives bbox-based fetching */
export function WeatherAlertMarkers({ alerts, onAlertsChange }: Props) {
  const map = useMap();
  const selectAlert = useMapStore((s) => s.selectAlert);
  const visibleCategories = useMapStore((s) => s.visibleCategories);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hold a ref to the current alerts so the stable click handler can look up
  // the full alert object without being recreated on every render.
  const alertsRef = useRef<WeatherAlertApiItem[]>(alerts);
  alertsRef.current = alerts;

  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  // Use the default SVG renderer — it gives each polygon an interactive SVG
  // element that Leaflet can track for cursor changes and click events.
  // Canvas would be faster for thousands of features, but for ~hundreds of
  // weather alert polygons SVG is reliable and fully interactive.
  useEffect(() => {
    const layer = L.geoJSON(undefined, {
      style: (feature) => {
        const color = severityToColor((feature?.properties as { severity?: string })?.severity ?? "Unknown");
        return { color, fillColor: color, fillOpacity: 0.15, weight: 1.5 };
      },
      // Attach click handler once per feature; the stable ref lookup avoids
      // re-creating the handler on every alerts update.
      onEachFeature: (_feature, featureLayer) => {
        featureLayer.on("click", () => {
          const alertId = (_feature.properties as { alertId: string }).alertId;
          const alert = alertsRef.current.find((a) => a.id === alertId);
          if (alert) selectAlert(alert);
        });
      },
    });

    layer.addTo(map);
    geoJsonLayerRef.current = layer;

    return () => {
      layer.remove();
    };
    // selectAlert is a stable Zustand action — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Re-populate the SVG layer whenever alerts or category filters change.
  // clearLayers() + addData() is O(n) on the Leaflet side with no React diffing.
  useEffect(() => {
    const layer = geoJsonLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    const features: GeoJSON.Feature[] = alerts
      .filter((alert) => {
        if (!alert.geometry) return false;
        const categoryKey = EVENT_TO_CATEGORY[alert.event];
        return categoryKey === undefined || visibleCategories[categoryKey];
      })
      .map((alert) => ({
        type: "Feature" as const,
        geometry: alert.geometry as GeoJSON.Geometry,
        properties: { severity: alert.severity, alertId: alert.id },
      }));

    if (features.length > 0) {
      layer.addData({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection);
    }
  }, [alerts, visibleCategories]);

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

  useEffect(() => {
    fetchAlerts();
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMapEvents({ moveend: scheduleFetch });

  // All rendering is handled by the native Leaflet GeoJSON layer.
  return null;
}
