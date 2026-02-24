import type GeoJSON from "geojson";

export interface GeocodingSuggestion {
  label: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  geometry: GeoJSON.LineString;
  /** "LINESTRING(lng lat, ...)" for PostGIS $param input */
  geometryWkt: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface CorridorResult {
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  /** JSON string for PostGIS ST_GeomFromGeoJSON($1) */
  geometryGeoJson: string;
}

interface BaseRouteHazard {
  id: string;
  severity: string;
  /** 4=CRITICAL/Extreme … 1=INFO/Minor — used for tie-breaking sort */
  severityRank: number;
  title: string;
  /** 0.0=origin, 1.0=destination — ST_LineLocatePoint result */
  positionAlongRoute: number;
  geometry: GeoJSON.Geometry;
}

export interface RoadEventRouteHazard extends BaseRouteHazard {
  kind: "road_event";
  type: string;
  direction: string | null;
  routeName: string | null;
  description: string | null;
  expectedEndAt: string | null;
  laneImpact: unknown;
  vehicleRestrictions: unknown[];
  source: string;
  state: string;
}

export interface WeatherAlertRouteHazard extends BaseRouteHazard {
  kind: "weather_alert";
  event: string;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  expires: string | null;
  areaDescription: string;
}

export interface CommunityReportRouteHazard extends BaseRouteHazard {
  kind: "community_report";
  reportType: string;
  description: string | null;
  locationDescription: string | null;
  upvotes: number;
  downvotes: number;
  reportedAt: string;
}

export type RouteHazard =
  | RoadEventRouteHazard
  | WeatherAlertRouteHazard
  | CommunityReportRouteHazard;

export interface RouteCheckResponse {
  route: {
    originAddress: string;
    originLat: number;
    originLng: number;
    destinationAddress: string;
    destinationLat: number;
    destinationLng: number;
    distanceMeters: number;
    durationSeconds: number;
    geometry: GeoJSON.LineString;
    corridorGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  };
  hazards: RouteHazard[];
  summary: {
    totalHazards: number;
    criticalCount: number;
    warningCount: number;
    advisoryCount: number;
    infoCount: number;
    roadEventCount: number;
    weatherAlertCount: number;
    communityReportCount: number;
  };
  checkedAt: string;
}

export interface RouteCheckRequest {
  originAddress: string;
  originLat?: number;
  originLng?: number;
  destinationAddress: string;
  destinationLat?: number;
  destinationLng?: number;
  /** Default 10, max 50 */
  corridorMiles?: number;
}
