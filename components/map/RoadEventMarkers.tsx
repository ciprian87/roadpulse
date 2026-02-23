"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { RoadEventApiItem } from "@/lib/types/road-event";
import type { ClusterPoint } from "@/app/api/events/clusters/route";
import { severityToColor } from "@/lib/utils/severity";
import { createEventIcon, createClosureEndpointIcon } from "@/lib/utils/event-icons";
import { useMapStore } from "@/stores/map-store";
import { ROAD_TYPE_TO_CATEGORY } from "@/lib/utils/alert-categories";

// Zoom threshold: at or above this zoom show individual events;
// below it show cluster count-bubbles from the server.
// 10 keeps clusters active through zoom 8-9 (multi-state/regional views)
// where the 500-event cap would otherwise only fill with dense east-coast
// events and leave western states appearing empty.
const CLUSTER_ZOOM_THRESHOLD = 10;

interface Props {
  events: RoadEventApiItem[];
  onEventsChange: (events: RoadEventApiItem[]) => void;
}

function isClosure(event: RoadEventApiItem): boolean {
  return event.severity === "CRITICAL" || event.type === "CLOSURE";
}

function toLLng(coord: number[]): L.LatLngExpression {
  return [coord[1]!, coord[0]!] as L.LatLngExpression;
}

function geometryToLineFeature(
  geometry: GeoJSON.Geometry,
  id: string,
  severity: string,
  closed: boolean
): GeoJSON.Feature | null {
  if (geometry.type === "MultiPoint") {
    if (geometry.coordinates.length < 2) return null;
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: geometry.coordinates },
      properties: { id, severity, closed },
    };
  }
  if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
    return { type: "Feature", geometry, properties: { id, severity, closed } };
  }
  return null;
}

function firstCoord(geometry: GeoJSON.Geometry): L.LatLngExpression | null {
  if (geometry.type === "Point") return toLLng(geometry.coordinates);
  if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    return geometry.coordinates[0] ? toLLng(geometry.coordinates[0]) : null;
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates[0]?.[0] ? toLLng(geometry.coordinates[0][0]) : null;
  }
  return null;
}

function lastCoord(geometry: GeoJSON.Geometry): L.LatLngExpression | null {
  if (geometry.type === "Point") return null;
  if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    const coords = geometry.coordinates;
    return coords.length > 1 ? toLLng(coords[coords.length - 1]!) : null;
  }
  if (geometry.type === "MultiLineString") {
    const lines = geometry.coordinates;
    const lastLine = lines[lines.length - 1];
    return lastLine && lastLine.length > 0
      ? toLLng(lastLine[lastLine.length - 1]!)
      : null;
  }
  return null;
}

/** Build an L.DivIcon count-bubble for a cluster marker. */
function createClusterIcon(count: number, hasCritical: boolean, hasWarning: boolean): L.DivIcon {
  const color = hasCritical ? "#ff4d4f" : hasWarning ? "#ff8c00" : "#4096ff";
  const size = count > 99 ? 46 : count > 9 ? 40 : 34;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background-color:${color};
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 8px rgba(0,0,0,0.45);
      display:flex;align-items:center;justify-content:center;
      font-size:${count > 99 ? 11 : 12}px;
      font-weight:700;color:white;
      font-family:system-ui,sans-serif;
    ">${count > 999 ? "999+" : count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function RoadEventMarkers({ events, onEventsChange }: Props) {
  const map = useMap();
  const selectEvent = useMapStore((s) => s.selectEvent);
  const visibleRoadTypes = useMapStore((s) => s.visibleRoadTypes);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eventsRef = useRef<RoadEventApiItem[]>(events);
  eventsRef.current = events;

  const lineLayerRef = useRef<L.GeoJSON | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  // Cluster bubbles live in their own group so the render effect (which only
  // manages individual-event layers) never wipes them on the React cycle that
  // follows onEventsChange([]).
  const clusterGroupRef = useRef<L.LayerGroup | null>(null);

  // Create canvas line layer + marker groups once on mount
  useEffect(() => {
    const renderer = L.canvas({ padding: 0.5 });

    // `renderer` is a valid Leaflet Path option accepted by L.geoJSON at runtime
    // but missing from @types/leaflet GeoJSONOptions — cast through unknown.
    const lineLayer = L.geoJSON(undefined, {
      renderer,
      style: (feature: GeoJSON.Feature) => {
        const { severity, closed } = (feature?.properties ?? {}) as {
          severity: string;
          closed: boolean;
        };
        if (closed) {
          return { color: "#ff4d4f", weight: 5, opacity: 0.9, dashArray: "10 7" };
        }
        return { color: severityToColor(severity), weight: 4, opacity: 0.85 };
      },
      onEachFeature: (_feature: GeoJSON.Feature, featureLayer: L.Layer) => {
        featureLayer.on("click", () => {
          const id: string = (_feature.properties as { id: string }).id;
          const event = eventsRef.current.find((e) => e.id === id);
          if (event) selectEvent(event);
        });
      },
    } as unknown as L.GeoJSONOptions);

    lineLayer.addTo(map);
    lineLayerRef.current = lineLayer;

    const markerGroup = L.layerGroup().addTo(map);
    markerGroupRef.current = markerGroup;

    const clusterGroup = L.layerGroup().addTo(map);
    clusterGroupRef.current = clusterGroup;

    return () => {
      lineLayer.remove();
      markerGroup.remove();
      clusterGroup.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Re-render layers whenever events or visibility filters change
  useEffect(() => {
    const lineLayer = lineLayerRef.current;
    const markerGroup = markerGroupRef.current;
    if (!lineLayer || !markerGroup) return;

    lineLayer.clearLayers();
    markerGroup.clearLayers();

    const visible = events.filter((event) => {
      const categoryKey = ROAD_TYPE_TO_CATEGORY[event.type];
      return categoryKey === undefined || visibleRoadTypes[categoryKey];
    });

    for (const event of visible) {
      if (!event.geometry) continue;

      const closed = isClosure(event);
      const onClick = () => selectEvent(event);

      // Line segment on canvas layer
      const lineFeature = geometryToLineFeature(event.geometry, event.id, event.severity, closed);
      if (lineFeature) lineLayer.addData(lineFeature);

      // Icon marker at start
      const start = firstCoord(event.geometry);
      if (start) {
        const icon = closed ? createClosureEndpointIcon() : createEventIcon(event.type, event.severity);
        const m = L.marker(start, { icon });
        m.on("click", onClick);
        markerGroup.addLayer(m);
      }

      // Barrier marker at end of closures
      if (closed) {
        const end = lastCoord(event.geometry);
        if (end) {
          const m = L.marker(end, { icon: createClosureEndpointIcon() });
          m.on("click", onClick);
          markerGroup.addLayer(m);
        }
      }
    }
  }, [events, visibleRoadTypes, selectEvent]);

  function fetchForZoom() {
    const bounds = map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ].join(",");
    const zoom = Math.round(map.getZoom());

    if (zoom < CLUSTER_ZOOM_THRESHOLD) {
      // Low zoom: fetch server-side clusters, render as count-bubbles.
      // Bubbles go into clusterGroupRef — a layer the render effect never
      // touches — so the React cycle triggered by onEventsChange([]) cannot
      // wipe them before they appear.
      fetch(`/api/events/clusters?bbox=${bbox}&zoom=${zoom}`)
        .then((r) => r.json())
        .then((data: { clusters: ClusterPoint[] }) => {
          lineLayerRef.current?.clearLayers();
          markerGroupRef.current?.clearLayers();
          clusterGroupRef.current?.clearLayers();
          onEventsChange([]); // render effect fires but only clears lineLayer + markerGroup (already empty)

          const clusterGroup = clusterGroupRef.current;
          if (!clusterGroup) return;
          for (const cluster of data.clusters ?? []) {
            const [lng, lat] = cluster.geometry.coordinates;
            if (lng === undefined || lat === undefined) continue;
            const icon = createClusterIcon(cluster.count, cluster.has_critical, cluster.has_warning);
            const m = L.marker([lat, lng], { icon });
            clusterGroup.addLayer(m);
          }
        })
        .catch(() => {
          // Non-fatal: keep current view
        });
    } else {
      // High zoom: clear cluster bubbles and fetch individual events.
      clusterGroupRef.current?.clearLayers();
      fetch(`/api/events?bbox=${bbox}&active_only=true&zoom=${zoom}`)
        .then((r) => r.json())
        .then((data: { events: RoadEventApiItem[] }) => {
          onEventsChange(data.events ?? []);
        })
        .catch(() => {});
    }
  }

  function scheduleFetch() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(fetchForZoom, 400);
  }

  useEffect(() => {
    fetchForZoom();
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMapEvents({ moveend: scheduleFetch });

  return null;
}
