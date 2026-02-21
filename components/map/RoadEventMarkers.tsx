"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapEvents, Polyline, Marker } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { RoadEventApiItem } from "@/lib/types/road-event";
import { severityToColor } from "@/lib/utils/severity";
import { createEventIcon, createClosureEndpointIcon } from "@/lib/utils/event-icons";
import { useMapStore } from "@/stores/map-store";
import { ROAD_TYPE_TO_CATEGORY } from "@/lib/utils/alert-categories";

interface Props {
  events: RoadEventApiItem[];
  onEventsChange: (events: RoadEventApiItem[]) => void;
}

/**
 * An event is treated as a full closure when:
 *   - severity is CRITICAL (vehicle_impact = all-lanes-closed), OR
 *   - type is CLOSURE (explicit full-closure events from future 511 feeds)
 */
function isClosure(event: RoadEventApiItem): boolean {
  return event.severity === "CRITICAL" || event.type === "CLOSURE";
}

/** GeoJSON [lng, lat] → Leaflet [lat, lng] */
function toLLExpr(coord: number[]): LatLngExpression {
  return [coord[1]!, coord[0]!] as LatLngExpression;
}

function renderEvent(event: RoadEventApiItem, onClick: () => void): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const { geometry, id, type, severity } = event;
  if (!geometry) return nodes;

  const closed = isClosure(event);
  const severityColor = severityToColor(severity);
  const eventIcon = createEventIcon(type, severity);
  const barrierIcon = createClosureEndpointIcon();

  // ── MultiPoint — Iowa WZDx format: two coordinates mark the start/end of a zone ──
  if (geometry.type === "MultiPoint") {
    const coords = geometry.coordinates;

    if (closed && coords.length >= 2) {
      // Full closure: thick red dashed line + barrier markers at each endpoint
      nodes.push(
        <Polyline
          key={`${id}-closure-line`}
          positions={coords.map(toLLExpr)}
          pathOptions={{ color: "#ff4d4f", weight: 5, opacity: 0.9, dashArray: "10 7" }}
          eventHandlers={{ click: onClick }}
        />
      );
      // Barrier marker at start
      nodes.push(
        <Marker
          key={`${id}-barrier-0`}
          position={toLLExpr(coords[0]!)}
          icon={barrierIcon}
          eventHandlers={{ click: onClick }}
        />
      );
      // Barrier marker at end (only if distinct from start)
      if (coords.length > 1) {
        nodes.push(
          <Marker
            key={`${id}-barrier-end`}
            position={toLLExpr(coords[coords.length - 1]!)}
            icon={barrierIcon}
            eventHandlers={{ click: onClick }}
          />
        );
      }
    } else {
      // Non-closure: thin colored line showing the zone span + icon at the start point
      if (coords.length >= 2) {
        nodes.push(
          <Polyline
            key={`${id}-span-line`}
            positions={coords.map(toLLExpr)}
            pathOptions={{ color: severityColor, weight: 3, opacity: 0.6 }}
            eventHandlers={{ click: onClick }}
          />
        );
      }
      // Event-type icon at the start of the zone
      nodes.push(
        <Marker
          key={`${id}-icon`}
          position={toLLExpr(coords[0]!)}
          icon={eventIcon}
          eventHandlers={{ click: onClick }}
        />
      );
    }
  }

  // ── LineString ───────────────────────────────────────────────────────────────
  else if (geometry.type === "LineString") {
    const coords = geometry.coordinates;
    const positions = coords.map(toLLExpr);

    if (closed) {
      nodes.push(
        <Polyline
          key={`${id}-closure-line`}
          positions={positions}
          pathOptions={{ color: "#ff4d4f", weight: 5, opacity: 0.9, dashArray: "10 7" }}
          eventHandlers={{ click: onClick }}
        />
      );
      nodes.push(
        <Marker
          key={`${id}-barrier-start`}
          position={toLLExpr(coords[0]!)}
          icon={barrierIcon}
          eventHandlers={{ click: onClick }}
        />
      );
      if (coords.length > 1) {
        nodes.push(
          <Marker
            key={`${id}-barrier-end`}
            position={toLLExpr(coords[coords.length - 1]!)}
            icon={barrierIcon}
            eventHandlers={{ click: onClick }}
          />
        );
      }
    } else {
      nodes.push(
        <Polyline
          key={`${id}-line`}
          positions={positions}
          pathOptions={{ color: severityColor, weight: 4, opacity: 0.85 }}
          eventHandlers={{ click: onClick }}
        />
      );
      nodes.push(
        <Marker
          key={`${id}-icon`}
          position={toLLExpr(coords[0]!)}
          icon={eventIcon}
          eventHandlers={{ click: onClick }}
        />
      );
    }
  }

  // ── MultiLineString ──────────────────────────────────────────────────────────
  else if (geometry.type === "MultiLineString") {
    geometry.coordinates.forEach((line, li) => {
      const positions = line.map(toLLExpr);

      if (closed) {
        nodes.push(
          <Polyline
            key={`${id}-closure-${li}`}
            positions={positions}
            pathOptions={{ color: "#ff4d4f", weight: 5, opacity: 0.9, dashArray: "10 7" }}
            eventHandlers={{ click: onClick }}
          />
        );
        if (li === 0 && line[0]) {
          nodes.push(
            <Marker
              key={`${id}-barrier-start`}
              position={toLLExpr(line[0])}
              icon={barrierIcon}
              eventHandlers={{ click: onClick }}
            />
          );
        }
        const lastLine = geometry.coordinates[geometry.coordinates.length - 1];
        if (li === geometry.coordinates.length - 1 && lastLine && lastLine.length > 0) {
          nodes.push(
            <Marker
              key={`${id}-barrier-end`}
              position={toLLExpr(lastLine[lastLine.length - 1]!)}
              icon={barrierIcon}
              eventHandlers={{ click: onClick }}
            />
          );
        }
      } else {
        nodes.push(
          <Polyline
            key={`${id}-line-${li}`}
            positions={positions}
            pathOptions={{ color: severityColor, weight: 4, opacity: 0.85 }}
            eventHandlers={{ click: onClick }}
          />
        );
        if (li === 0 && line[0]) {
          nodes.push(
            <Marker
              key={`${id}-icon`}
              position={toLLExpr(line[0])}
              icon={eventIcon}
              eventHandlers={{ click: onClick }}
            />
          );
        }
      }
    });
  }

  // ── Point ────────────────────────────────────────────────────────────────────
  else if (geometry.type === "Point") {
    nodes.push(
      <Marker
        key={`${id}-point`}
        position={toLLExpr(geometry.coordinates)}
        icon={closed ? barrierIcon : eventIcon}
        eventHandlers={{ click: onClick }}
      />
    );
  }

  return nodes;
}

/** Inner component that lives inside <MapContainer> and drives bbox-based fetching */
export function RoadEventMarkers({ events, onEventsChange }: Props) {
  const map = useMap();
  const selectEvent = useMapStore((s) => s.selectEvent);
  const visibleRoadTypes = useMapStore((s) => s.visibleRoadTypes);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fetchEvents() {
    const bounds = map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ].join(",");

    fetch(`/api/events?bbox=${bbox}&active_only=true&limit=500`)
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

  return (
    <>
      {events.map((event) => {
        // Filter by visible road type category (fail-open for unmapped types)
        const categoryKey = ROAD_TYPE_TO_CATEGORY[event.type];
        if (categoryKey !== undefined && !visibleRoadTypes[categoryKey]) return null;
        return renderEvent(event, () => selectEvent(event));
      })}
    </>
  );
}
