import { cacheGet, cacheSet } from "@/lib/cache/redis";

// NWS zone geometries change very rarely (only when zone boundaries are redrawn).
// 24-hour TTL keeps us well within NWS rate limits while staying reasonably fresh.
const ZONE_CACHE_TTL_S = 86_400;

interface NwsZoneFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry | null;
}

async function fetchOneZoneGeometry(
  zoneUrl: string
): Promise<GeoJSON.Geometry | null> {
  const zoneId = zoneUrl.split("/").pop() ?? zoneUrl;
  const cacheKey = `nws:zone:geom:${zoneId}`;

  // Sentinel value "null" means we already know NWS has no geometry for this zone
  const cached = await cacheGet(cacheKey).catch(() => null);
  if (cached !== null) {
    return cached === "null" ? null : (JSON.parse(cached) as GeoJSON.Geometry);
  }

  const userAgent = process.env.NWS_USER_AGENT ?? "RoadPulse";
  let geometry: GeoJSON.Geometry | null = null;

  try {
    const res = await fetch(zoneUrl, {
      headers: { "User-Agent": userAgent, Accept: "application/geo+json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as NwsZoneFeature;
      geometry = data.geometry ?? null;
    }
  } catch {
    // Network failure — don't cache so the next run retries
    return null;
  }

  await cacheSet(
    cacheKey,
    geometry ? JSON.stringify(geometry) : "null",
    ZONE_CACHE_TTL_S
  ).catch(() => undefined);

  return geometry;
}

/**
 * Fetch zone geometries for a set of zone URLs concurrently, deduplicating
 * across calls. Up to `concurrency` requests run in parallel.
 * Returns a URL → GeoJSON geometry map (null means no geometry for that zone).
 *
 * On first ingestion run all zones hit the NWS API; subsequent runs are
 * served entirely from Redis for 24 hours.
 */
export async function fetchZoneGeometryMap(
  zoneUrls: string[],
  concurrency = 5
): Promise<Map<string, GeoJSON.Geometry | null>> {
  const unique = [...new Set(zoneUrls)];
  const map = new Map<string, GeoJSON.Geometry | null>();

  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < unique.length) {
      const url = unique[idx++]!;
      map.set(url, await fetchOneZoneGeometry(url));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, worker)
  );

  return map;
}

/**
 * Merge polygon geometries from multiple NWS zones into a single GeoJSON
 * MultiPolygon by collecting all polygon rings.
 * Returns null when no valid polygon rings are found (e.g. all zones are
 * point features or returned no geometry).
 *
 * PostGIS will further validate and index the result via ST_GeomFromGeoJSON.
 */
export function mergeToMultiPolygon(
  geometries: (GeoJSON.Geometry | null | undefined)[]
): GeoJSON.MultiPolygon | null {
  const rings: GeoJSON.Position[][][] = [];

  for (const geom of geometries) {
    if (!geom) continue;
    if (geom.type === "Polygon") rings.push(geom.coordinates);
    else if (geom.type === "MultiPolygon") rings.push(...geom.coordinates);
    // Point/LineString zones carry no area — skip them
  }

  return rings.length > 0 ? { type: "MultiPolygon", coordinates: rings } : null;
}
