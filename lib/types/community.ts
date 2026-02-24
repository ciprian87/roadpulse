import type GeoJSON from "geojson";

export type CommunityReportType =
  | "ROAD_HAZARD"
  | "CLOSURE_UPDATE"
  | "WEATHER_CONDITION"
  | "WAIT_TIME"
  | "PARKING_FULL"
  | "OTHER";

export interface CommunityReportApiItem {
  id: string;
  user_id: string | null;
  type: CommunityReportType;
  title: string;
  description: string | null;
  /** GeoJSON Point {type:"Point", coordinates:[lng, lat]} */
  geometry: GeoJSON.Point;
  location_description: string | null;
  route_name: string | null;
  state: string | null;
  severity: string;
  upvotes: number;
  downvotes: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  /** Populated when the requesting user is authenticated */
  user_vote?: "up" | "down" | null;
}

export const REPORT_TYPE_LABELS: Record<CommunityReportType, string> = {
  ROAD_HAZARD:       "🚧 Road Hazard",
  CLOSURE_UPDATE:    "📋 Closure Update",
  WEATHER_CONDITION: "🌧️ Weather Condition",
  WAIT_TIME:         "⏱️ Wait Time",
  PARKING_FULL:      "🅿️ Parking Full",
  OTHER:             "📝 Other",
};

export const REPORT_TYPE_SHORT: Record<CommunityReportType, string> = {
  ROAD_HAZARD:       "Road Hazard",
  CLOSURE_UPDATE:    "Closure",
  WEATHER_CONDITION: "Weather",
  WAIT_TIME:         "Wait Time",
  PARKING_FULL:      "Parking",
  OTHER:             "Other",
};

// How long each report type stays active after submission
export const REPORT_EXPIRY_HOURS: Record<CommunityReportType, number> = {
  ROAD_HAZARD:       8,
  CLOSURE_UPDATE:    24,
  WEATHER_CONDITION: 8,
  WAIT_TIME:         4,
  PARKING_FULL:      4,
  OTHER:             12,
};
