"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { useRouteStore } from "@/stores/route-store";
import { useMapStore } from "@/stores/map-store";

/**
 * Renders the route polyline and corridor buffer overlay on the Leaflet map.
 * Reads from the route store — renders nothing when no result is present.
 * Fits the map bounds to the route on each new result.
 * Reacts to flyToTarget to pan the map when a hazard card is selected.
 */
export function RouteLayer() {
  const map = useMap();
  const result = useRouteStore((s) => s.result);
  const flyToTarget = useRouteStore((s) => s.flyToTarget);
  const setFlyToTarget = useRouteStore((s) => s.setFlyToTarget);
  const selectedHazard = useMapStore((s) => s.selectedHazard);
  const prevSelectedHazardRef = useRef(selectedHazard);
  const corridorRef = useRef<L.GeoJSON | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);

  // Re-fit to full route bounds when the detail panel is closed
  useEffect(() => {
    const prev = prevSelectedHazardRef.current;
    prevSelectedHazardRef.current = selectedHazard;
    // Only act on a non-null → null transition while a route is on screen
    if (prev !== null && selectedHazard === null && routeRef.current) {
      map.fitBounds(routeRef.current.getBounds(), { padding: [40, 40] });
    }
  }, [selectedHazard, map]);

  // Pan to hazard location when a card is clicked
  useEffect(() => {
    if (!flyToTarget) return;
    map.flyTo(flyToTarget, Math.max(map.getZoom(), 10), { duration: 1 });
    setFlyToTarget(null);
  }, [flyToTarget, map, setFlyToTarget]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      corridorRef.current?.remove();
      routeRef.current?.remove();
    };
  }, [map]);

  // Re-render whenever the route result changes
  useEffect(() => {
    corridorRef.current?.remove();
    corridorRef.current = null;
    routeRef.current?.remove();
    routeRef.current = null;

    if (!result) return;

    // Corridor: semi-transparent fill with dashed border
    const corridorLayer = L.geoJSON(
      result.route.corridorGeometry as unknown as GeoJSON.GeoJsonObject,
      {
        style: {
          fillColor: "#4096ff",
          fillOpacity: 0.08,
          color: "#4096ff",
          weight: 1,
          dashArray: "6 4",
        },
      }
    );
    corridorLayer.addTo(map);
    corridorRef.current = corridorLayer;

    // Route polyline — GeoJSON is [lng, lat]; Leaflet needs [lat, lng]
    const latLngs = result.route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as L.LatLngTuple
    );
    const routePolyline = L.polyline(latLngs, {
      color: "#4096ff",
      weight: 5,
      opacity: 0.9,
    });
    routePolyline.addTo(map);
    routeRef.current = routePolyline;

    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
  }, [result, map]);

  return null;
}
