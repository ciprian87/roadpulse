"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { RoadEventApiItem } from "@/lib/types/road-event";
import { severityToColor } from "@/lib/utils/severity";
import { createEventIcon, createClosureEndpointIcon } from "@/lib/utils/event-icons";
import { useMapStore } from "@/stores/map-store";
import { ROAD_TYPE_TO_CATEGORY } from "@/lib/utils/alert-categories";

interface Props {
  events: RoadEventApiItem[];
  onEventsChange: (events: RoadEventApiItem[]) => void;
}

function isClosure(event: RoadEventApiItem): boolean {
  return event.severity === "CRITICAL" || event.type === "CLOSURE";
}

/** GeoJSON [lng, lat] → Leaflet [lat, lng] */
function toLLng(coord: number[]): L.LatLngExpression {
  return [coord[1]!, coord[0]!] as L.LatLngExpression;
}

/**
 * Convert a road event geometry into a GeoJSON LineString/MultiLineString
 * suitable for the canvas polyline layer.
 * MultiPoint → LineString (the two points mark start/end of zone).
 * Point geometries have no line to draw; return null.
 */
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

/** Extract the first coordinate of any geometry as a Leaflet LatLng. */
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

/** Extract the last coordinate of any geometry as a Leaflet LatLng. */
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

/** Inner component that lives inside <MapContainer> and drives bbox-based fetching */
export function RoadEventMarkers({ events, onEventsChange }: Props) {
  const map = useMap();
  const selectEvent = useMapStore((s) => s.selectEvent);
  const visibleRoadTypes = useMapStore((s) => s.visibleRoadTypes);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable ref so the GeoJSON click handler can look up the event without
  // being recreated on every render.
  const eventsRef = useRef<RoadEventApiItem[]>(events);
  eventsRef.current = events;

  const lineLayerRef = useRef<L.GeoJSON | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);

  // Create the canvas line layer + a marker group once on mount.
  // Canvas: all polylines share one <canvas> element → O(1) DOM nodes regardless
  // of event count. Marker group uses DOM-based DivIcons (unavoidable for custom icons)
  // but there are far fewer of them than line segments.
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

    return () => {
      lineLayer.remove();
      markerGroup.remove();
    };
    // selectEvent is a stable Zustand action
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Re-render all layers when events or visibility filters change.
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

      // ── Line segment on canvas layer ────────────────────────────────────
      const lineFeature = geometryToLineFeature(
        event.geometry,
        event.id,
        event.severity,
        closed
      );
      if (lineFeature) {
        lineLayer.addData(lineFeature);
      }

      // ── Icon marker at the start of the zone ────────────────────────────
      const start = firstCoord(event.geometry);
      if (start) {
        const icon = closed ? createClosureEndpointIcon() : createEventIcon(event.type, event.severity);
        const m = L.marker(start, { icon });
        m.on("click", onClick);
        markerGroup.addLayer(m);
      }

      // ── Barrier marker at end of closures ───────────────────────────────
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

  function fetchEvents() {
    const bounds = map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ].join(",");
    const zoom = Math.round(map.getZoom());
    fetch(`/api/events?bbox=${bbox}&active_only=true&zoom=${zoom}`)
      .then((r) => r.json())
      .then((data: { events: RoadEventApiItem[] }) => {
        onEventsChange(data.events ?? []);
      })
      .catch(() => {
        // Fetch failures are non-fatal; current events remain visible
      });
  }

  function scheduleFetch() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(fetchEvents, 400);
  }

  useEffect(() => {
    fetchEvents();
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMapEvents({ moveend: scheduleFetch });

  // All rendering is handled by native Leaflet layers.
  return null;
}
