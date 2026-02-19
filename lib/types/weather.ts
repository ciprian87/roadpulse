/**
 * Shape returned by GET /api/weather/alerts for a single alert.
 * Matches the AlertRow selected in the API route handler, with geometry
 * already converted to GeoJSON via ST_AsGeoJSON.
 */
export interface WeatherAlertApiItem {
  id: string;
  nws_id: string;
  event: string;
  severity: string;
  urgency: string | null;
  certainty: string | null;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  area_description: string;
  affected_zones: string[];
  /** GeoJSON geometry (polygon/multipolygon) or null when NWS has no geometry */
  geometry: GeoJSON.Geometry | null;
  onset: string | null;
  expires: string | null;
  last_updated_at: string | null;
  sender_name: string | null;
  wind_speed: string | null;
  snow_amount: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WeatherAlertsApiResponse {
  alerts: WeatherAlertApiItem[];
  total: number;
  filters: {
    state: string | null;
    event: string | null;
    severity: string | null;
    bbox: string | null;
    active_only: boolean;
    limit: number;
    offset: number;
  };
}
