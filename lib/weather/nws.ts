// NWS alert types relevant to commercial truck drivers.
// Narrowly scoped to events that affect road conditions or driver safety.
// Informational watches (e.g. Freeze Watch, Frost Advisory) are intentionally excluded
// because they don't change road conditions for CMV operators.
export const ROAD_RELEVANT_ALERT_TYPES = new Set([
  "Winter Storm Warning",
  "Winter Storm Watch",
  "Blizzard Warning",
  "Ice Storm Warning",
  "Wind Advisory",
  "High Wind Warning",
  "Flood Warning",
  "Flash Flood Warning",
  "Tornado Warning",
  "Dense Fog Advisory",
  "Freezing Fog Advisory",
  "Extreme Cold Warning",
  "Wind Chill Warning",
  "Wind Chill Advisory",
  "Dust Storm Warning",
  "Tropical Storm Warning",
  "Hurricane Warning",
  "Winter Weather Advisory",
  "Freezing Rain Advisory",
  "Heavy Snow Warning",
]);

// Raw shapes from the NWS GeoJSON alerts API.
// https://www.weather.gov/documentation/services-web-api

interface NwsAlertsResponse {
  type: "FeatureCollection";
  features: NwsAlertFeature[];
}

export interface NwsAlertFeature {
  id: string;
  type: "Feature";
  geometry: NwsGeometry | null;
  properties: NwsAlertProperties;
}

type NwsGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] }
  | { type: "Point"; coordinates: number[] };

interface NwsAlertProperties {
  id: string;
  event: string;
  severity: string;
  urgency: string;
  certainty: string;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  areaDesc: string;
  affectedZones: string[];
  onset: string | null;
  expires: string | null;
  senderName: string | null;
  messageType: string;
  status: string;
}

// Normalized shape ready for DB upsert via weather-ingest.ts
export interface NormalizedAlert {
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
  // Serialized GeoJSON string for ST_GeomFromGeoJSON(); null when NWS omits geometry
  geometry_geojson: string | null;
  onset: Date | null;
  expires: Date | null;
  sender_name: string | null;
  wind_speed: string | null;
  snow_amount: string | null;
  raw: NwsAlertFeature;
}

const NWS_ALERTS_URL = "https://api.weather.gov/alerts/active";

// Extract the zone ID from a NWS zone URL.
// e.g. "https://api.weather.gov/zones/forecast/COZ039" → "COZ039"
function extractZoneId(zoneUrl: string): string {
  return zoneUrl.split("/").pop() ?? zoneUrl;
}

// Extract wind speed from the alert description if present.
// NWS descriptions typically contain phrasing like "winds 35 to 45 mph" or "gusts up to 60 mph".
const WIND_SPEED_RE = /(\d+(?:\s*to\s*\d+)?)\s*mph/i;
function extractWindSpeed(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(WIND_SPEED_RE);
  return m ? `${m[1]} mph` : null;
}

// Extract snowfall accumulation from the alert description if present.
// NWS descriptions typically contain phrasing like "6 to 10 inches" or "up to 18 inches".
const SNOW_AMOUNT_RE = /(\d+(?:\.\d+)?(?:\s*to\s*\d+(?:\.\d+)?)?)\s*inch(?:es)?/i;
function extractSnowAmount(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(SNOW_AMOUNT_RE);
  return m ? `${m[1]} inches` : null;
}

function normalizeFeature(feature: NwsAlertFeature): NormalizedAlert {
  const p = feature.properties;
  return {
    nws_id: p.id,
    event: p.event,
    severity: p.severity,
    urgency: p.urgency ?? null,
    certainty: p.certainty ?? null,
    headline: p.headline,
    description: p.description,
    instruction: p.instruction,
    area_description: p.areaDesc,
    affected_zones: p.affectedZones.map(extractZoneId),
    geometry_geojson: feature.geometry
      ? JSON.stringify(feature.geometry)
      : null,
    onset: p.onset ? new Date(p.onset) : null,
    expires: p.expires ? new Date(p.expires) : null,
    sender_name: p.senderName,
    wind_speed: extractWindSpeed(p.description),
    snow_amount: extractSnowAmount(p.description),
    raw: feature,
  };
}

// Fetch the raw NWS response as text.
// Callers (ingestion layer) are responsible for caching this string in Redis
// so we stay within NWS's ~1 req/s rate limit on rapid refreshes.
export async function fetchRawAlerts(): Promise<string> {
  const userAgent = process.env.NWS_USER_AGENT;
  if (!userAgent) {
    throw new Error("NWS_USER_AGENT environment variable is not set");
  }

  const response = await fetch(NWS_ALERTS_URL, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/geo+json",
    },
    // Never use HTTP-level caching — Redis handles our 2-minute TTL
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `NWS API returned ${response.status}: ${response.statusText}`
    );
  }

  return response.text();
}

// Parse a raw NWS GeoJSON string into normalized, road-relevant alerts.
// Filters out non-Actual messages (Test, Exercise) and non-road-relevant event types.
export function parseAlerts(rawJson: string): NormalizedAlert[] {
  const data: unknown = JSON.parse(rawJson);

  if (
    !data ||
    typeof data !== "object" ||
    !("features" in data) ||
    !Array.isArray((data as NwsAlertsResponse).features)
  ) {
    throw new Error("NWS API returned unexpected response shape");
  }

  const { features } = data as NwsAlertsResponse;

  return features
    .filter(
      (f) =>
        f.type === "Feature" &&
        f.properties?.status === "Actual" &&
        ROAD_RELEVANT_ALERT_TYPES.has(f.properties?.event)
    )
    .map(normalizeFeature);
}

// Convenience: one-step fetch + normalize.
// Use fetchRawAlerts() + parseAlerts() directly when you need the caching split.
export async function fetchActiveAlerts(): Promise<NormalizedAlert[]> {
  const raw = await fetchRawAlerts();
  return parseAlerts(raw);
}
