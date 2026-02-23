"use client";

import { useState, useEffect } from "react";
import { MapContainer as LeafletMapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMapStore } from "@/stores/map-store";
import { WeatherAlertMarkers } from "./WeatherAlertMarkers";
import { RoadEventMarkers } from "./RoadEventMarkers";
import { HazardDetailPanel } from "@/components/alerts/HazardDetailPanel";
import { MapFilterBar } from "./MapFilterBar";
import { MapLegend } from "./MapLegend";
import { ZoomTracker, ZoomBadge } from "./ZoomDisplay";
import type { WeatherAlertApiItem } from "@/lib/types/weather";
import type { RoadEventApiItem } from "@/lib/types/road-event";

const DARK_TILE =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILE =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Flies to the user's geolocation once on mount */
function GeolocationFly() {
  const map = useMap();
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        map.flyTo([coords.latitude, coords.longitude], 8, { duration: 1.5 });
      },
      () => {
        // Permission denied or unavailable — stay at default center
      }
    );
  }, [map]);
  return null;
}

export default function MapView() {
  const center = useMapStore((s) => s.center);
  const zoom = useMapStore((s) => s.zoom);
  const darkMode = useMapStore((s) => s.darkMode);
  const [alerts, setAlerts] = useState<WeatherAlertApiItem[]>([]);
  const [events, setEvents] = useState<RoadEventApiItem[]>([]);

  return (
    // Relative container so the desktop HazardDetailPanel can use absolute positioning
    <div className="relative w-full h-full">
      <LeafletMapContainer
        center={center}
        zoom={zoom}
        minZoom={4}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          key={darkMode ? "dark" : "light"}
          url={darkMode ? DARK_TILE : LIGHT_TILE}
          attribution={TILE_ATTRIBUTION}
          maxZoom={19}
        />

        <GeolocationFly />
        <ZoomTracker />

        <WeatherAlertMarkers alerts={alerts} onAlertsChange={setAlerts} />
        <RoadEventMarkers events={events} onEventsChange={setEvents} />
      </LeafletMapContainer>

      {/* HazardDetailPanel lives outside the Leaflet DOM so it can overlay freely */}
      <HazardDetailPanel />

      {/* Both overlays live outside the Leaflet DOM — pointer-events passthrough to map */}
      <MapLegend />
      <MapFilterBar />
      <ZoomBadge />
    </div>
  );
}
