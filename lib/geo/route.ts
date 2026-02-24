import type { RouteResult } from "@/lib/types/route";

const ORS_BASE = "https://api.openrouteservice.org";

/**
 * Fetches a driving-HGV (heavy goods vehicle) route from ORS.
 * Coordinates are in WGS 84 (SRID 4326).
 *
 * Throws "ORS_RATE_LIMIT" on HTTP 429.
 * Throws "ROUTE_NOT_FOUND" when ORS returns no features or an error body.
 */
export async function fetchRoute(
  oLat: number,
  oLng: number,
  dLat: number,
  dLng: number
): Promise<RouteResult> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) throw new Error("OPENROUTESERVICE_API_KEY is not set");

  const res = await fetch(`${ORS_BASE}/v2/directions/driving-hgv/geojson`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json, application/geo+json",
    },
    // ORS expects [lng, lat] coordinate order
    body: JSON.stringify({ coordinates: [[oLng, oLat], [dLng, dLat]] }),
  });

  if (res.status === 429) throw new Error("ORS_RATE_LIMIT");

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    // ORS error bodies often contain a human-readable "error" field
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `ORS directions error ${res.status}`;
    throw new Error(message.toLowerCase().includes("route") ? "ROUTE_NOT_FOUND" : message);
  }

  const data = (await res.json()) as {
    features?: Array<{
      geometry: { type: "LineString"; coordinates: [number, number][] };
      properties: { summary: { distance: number; duration: number } };
    }>;
  };

  if (!data.features || data.features.length === 0) throw new Error("ROUTE_NOT_FOUND");

  const feature = data.features[0]!;
  const coords = feature.geometry.coordinates;

  // Build WKT for PostGIS — ST_GeomFromText("LINESTRING(...)", 4326)
  const geometryWkt =
    "LINESTRING(" + coords.map(([lng, lat]) => `${lng} ${lat}`).join(",") + ")";

  return {
    geometry: { type: "LineString", coordinates: coords },
    geometryWkt,
    distanceMeters: feature.properties.summary.distance,
    durationSeconds: feature.properties.summary.duration,
  };
}
