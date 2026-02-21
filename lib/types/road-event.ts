/**
 * Shape returned by GET /api/events for a single road event.
 * Matches the row selected in the API route handler, with geometry
 * already converted to GeoJSON via ST_AsGeoJSON.
 */
export interface RoadEventApiItem {
  id: string;
  source: string;
  source_event_id: string;
  state: string;
  /** CLOSURE | RESTRICTION | CONSTRUCTION | INCIDENT | WEATHER_CLOSURE | CHAIN_LAW | SPECIAL_EVENT */
  type: string;
  /** CRITICAL | WARNING | ADVISORY | INFO */
  severity: string;
  title: string;
  description: string | null;
  direction: string | null;
  route_name: string | null;
  /** GeoJSON geometry (LineString, MultiLineString, or Point) */
  geometry: GeoJSON.Geometry | null;
  location_description: string | null;
  started_at: string | null;
  expected_end_at: string | null;
  last_updated_at: string | null;
  lane_impact: { vehicle_impact: string; workers_present?: boolean } | null;
  vehicle_restrictions: { type: string; value?: number; unit?: string }[];
  detour_description: string | null;
  source_feed_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RoadEventsApiResponse {
  events: RoadEventApiItem[];
  total: number;
  filters: {
    state: string | null;
    type: string | null;
    severity: string | null;
    bbox: string | null;
    active_only: boolean;
    limit: number;
    offset: number;
  };
}
