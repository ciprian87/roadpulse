// Alert categories group NWS event types into thematic buckets for map filtering.
// Each category has a fixed display color and label.
// The "fire" category maps to CRITICAL red because Red Flag Warnings restrict
// CMV operations the same way blizzard warnings do.
//
// Road event categories group WZDx/511 event types into four broad buckets.
// ROAD_TYPE_TO_CATEGORY maps individual road_events.type values to a bucket key.

export interface AlertCategory {
  key: string;
  label: string;
  color: string; // hex, used for chip background and polygon fill
}

export const ALERT_CATEGORIES: AlertCategory[] = [
  { key: "winter",     label: "Winter",     color: "#4096ff" },
  { key: "wind",       label: "Wind",       color: "#ff8c00" },
  { key: "flood",      label: "Flood",      color: "#36cfc9" },
  { key: "fire",       label: "Fire",       color: "#ff4d4f" },
  { key: "visibility", label: "Visibility", color: "#ffd000" },
  { key: "severe",     label: "Severe",     color: "#c04aff" },
  { key: "cold",       label: "Cold",       color: "#8bb8ff" },
];

// Look up category key by NWS event name.
// Events absent from this map are shown unconditionally (fail-open).
export const EVENT_TO_CATEGORY: Record<string, string> = {
  // Winter
  "Winter Storm Warning":    "winter",
  "Winter Storm Watch":      "winter",
  "Blizzard Warning":        "winter",
  "Ice Storm Warning":       "winter",
  "Winter Weather Advisory": "winter",
  "Heavy Snow Warning":      "winter",
  "Freezing Rain Advisory":  "winter",

  // Wind
  "Wind Advisory":           "wind",
  "High Wind Warning":       "wind",
  "Dust Storm Warning":      "wind",
  "Tropical Storm Warning":  "wind",
  "Hurricane Warning":       "wind",

  // Flood
  "Flood Warning":           "flood",
  "Flash Flood Warning":     "flood",

  // Fire
  "Red Flag Warning":        "fire",
  "Fire Weather Watch":      "fire",

  // Visibility
  "Dense Fog Advisory":      "visibility",
  "Freezing Fog Advisory":   "visibility",

  // Avalanche — winter category since it's terrain + snow-driven
  "Avalanche Warning":       "winter",

  // Severe
  "Tornado Warning":         "severe",
  "Tornado Watch":           "severe",

  // Cold
  "Extreme Cold Warning":    "cold",
  "Wind Chill Warning":      "cold",
  "Wind Chill Advisory":     "cold",
};

// Initial state: all categories visible
export const DEFAULT_VISIBLE_CATEGORIES: Record<string, boolean> = Object.fromEntries(
  ALERT_CATEGORIES.map((c) => [c.key, true])
);

// ── Road event filter categories ───────────────────────────────────────────────

export interface RoadEventCategory {
  key: string;
  label: string;
  color: string;
}

export const ROAD_EVENT_CATEGORIES: RoadEventCategory[] = [
  { key: "construction", label: "Work Zones",   color: "#ff8c00" },
  { key: "closures",     label: "Closures",     color: "#ff4d4f" },
  { key: "restrictions", label: "Restrictions", color: "#ffd000" },
  { key: "incidents",    label: "Incidents",    color: "#f759ab" },
];

// Maps road_events.type values to a filter category key.
// Types absent from this map are always shown (fail-open).
export const ROAD_TYPE_TO_CATEGORY: Record<string, string> = {
  CONSTRUCTION:    "construction",
  CLOSURE:         "closures",
  WEATHER_CLOSURE: "closures",
  RESTRICTION:     "restrictions",
  CHAIN_LAW:       "restrictions",
  INCIDENT:        "incidents",
  SPECIAL_EVENT:   "incidents",
};

export const DEFAULT_VISIBLE_ROAD_TYPES: Record<string, boolean> = Object.fromEntries(
  ROAD_EVENT_CATEGORIES.map((c) => [c.key, true])
);
