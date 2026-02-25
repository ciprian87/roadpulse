import { pool } from "@/lib/db";
import type { ParkingFacilityApiItem, ParkingFacilityNearRoute } from "@/lib/types/parking";

/** One row of merged static + dynamic TPIMS data ready for upsert */
export interface ParkingUpsertRow {
  source: string;
  source_facility_id: string;
  name: string;
  state: string;
  highway: string | null;
  direction: string | null;
  latitude: number;
  longitude: number;
  total_spaces: number | null;
  available_spaces: number | null;
  trend: string | null;
  amenities: string[];
  last_updated_at: string | null;
}

interface FacilityRow {
  id: string;
  source: string;
  source_facility_id: string;
  name: string;
  state: string;
  highway: string | null;
  direction: string | null;
  geometry: GeoJSON.Point;
  total_spaces: number | null;
  available_spaces: number | null;
  trend: string | null;
  amenities: string[];
  last_updated_at: string | null;
  is_active: boolean;
}

interface NearCorridorRow extends FacilityRow {
  distance_from_route: string;
  position_along_route: string;
}

/**
 * Upsert parking facilities by (source, source_facility_id).
 * Uses PostGIS ST_MakePoint for the location geometry column.
 */
export async function upsertFacilities(rows: ParkingUpsertRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const client = await pool.connect();
  let upserted = 0;
  try {
    for (const row of rows) {
      await client.query(
        `INSERT INTO parking_facilities (
           source, source_facility_id, name, state, highway, direction,
           location, total_spaces, available_spaces, trend, amenities, last_updated_at, is_active
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           ST_SetSRID(ST_MakePoint($7, $8), 4326),
           $9, $10, $11, $12::jsonb, $13, true
         )
         ON CONFLICT (source, source_facility_id) DO UPDATE SET
           name             = EXCLUDED.name,
           state            = EXCLUDED.state,
           highway          = EXCLUDED.highway,
           direction        = EXCLUDED.direction,
           location         = EXCLUDED.location,
           total_spaces     = EXCLUDED.total_spaces,
           available_spaces = EXCLUDED.available_spaces,
           trend            = EXCLUDED.trend,
           amenities        = EXCLUDED.amenities,
           last_updated_at  = EXCLUDED.last_updated_at,
           is_active        = true`,
        [
          row.source,
          row.source_facility_id,
          row.name,
          row.state,
          row.highway,
          row.direction,
          row.longitude, // GeoJSON/PostGIS: ST_MakePoint(lng, lat)
          row.latitude,
          row.total_spaces,
          row.available_spaces,
          row.trend,
          JSON.stringify(row.amenities),
          row.last_updated_at,
        ]
      );
      upserted++;
    }
  } finally {
    client.release();
  }
  return upserted;
}

export interface ListFacilitiesOptions {
  bbox?: string;
  state?: string;
  highway?: string;
  availableOnly?: boolean;
  limit?: number;
  offset?: number;
}

/** List parking facilities with optional spatial + attribute filters */
export async function listFacilities(
  opts: ListFacilitiesOptions
): Promise<{ facilities: ParkingFacilityApiItem[]; total: number }> {
  const { availableOnly = false, limit = 100, offset = 0 } = opts;
  const effectiveLimit = Math.min(Math.max(1, limit), 500);

  const conditions: string[] = ["pf.is_active = true"];
  const params: unknown[] = [];
  let idx = 0;
  const p = (v: unknown) => { params.push(v); return `$${++idx}`; };

  if (opts.state) conditions.push(`pf.state = ${p(opts.state.toUpperCase().slice(0, 2))}`);
  if (opts.highway) conditions.push(`pf.highway = ${p(opts.highway)}`);
  if (availableOnly) conditions.push(`pf.available_spaces > 0`);

  if (opts.bbox) {
    const parts = opts.bbox.split(",").map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      const [west, south, east, north] = parts;
      conditions.push(
        `ST_Intersects(pf.location, ST_MakeEnvelope(${p(west)}, ${p(south)}, ${p(east)}, ${p(north)}, 4326))`
      );
    }
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const client = await pool.connect();
  try {
    const countRes = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM parking_facilities pf ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count ?? "0", 10);

    const dataRes = await client.query<FacilityRow>(
      `SELECT
         pf.id, pf.source, pf.source_facility_id, pf.name, pf.state, pf.highway, pf.direction,
         ST_AsGeoJSON(pf.location)::json AS geometry,
         pf.total_spaces, pf.available_spaces, pf.trend,
         pf.amenities::json AS amenities,
         pf.last_updated_at::text AS last_updated_at,
         pf.is_active
       FROM parking_facilities pf
       ${where}
       ORDER BY pf.name
       LIMIT ${p(effectiveLimit)} OFFSET ${p(offset)}`,
      params
    );

    return { facilities: dataRes.rows as unknown as ParkingFacilityApiItem[], total };
  } finally {
    client.release();
  }
}

/** Find parking facilities within radiusMeters of a lat/lng point */
export async function findNearPoint(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<ParkingFacilityApiItem[]> {
  const client = await pool.connect();
  try {
    const res = await client.query<FacilityRow>(
      `SELECT
         pf.id, pf.source, pf.source_facility_id, pf.name, pf.state, pf.highway, pf.direction,
         ST_AsGeoJSON(pf.location)::json AS geometry,
         pf.total_spaces, pf.available_spaces, pf.trend,
         pf.amenities::json AS amenities,
         pf.last_updated_at::text AS last_updated_at,
         pf.is_active
       FROM parking_facilities pf
       WHERE pf.is_active = true
         AND ST_DWithin(pf.location::geography, ST_MakePoint($1, $2)::geography, $3)
       ORDER BY ST_Distance(pf.location::geography, ST_MakePoint($1, $2)::geography)
       LIMIT 50`,
      [lng, lat, radiusMeters]
    );
    return res.rows as unknown as ParkingFacilityApiItem[];
  } finally {
    client.release();
  }
}

/**
 * Find parking facilities within radiusMeters of a route corridor.
 * Returns facilities ordered by position along the route (origin → destination).
 *
 * $1 = corridorGeoJson  (used for DWithin geography check)
 * $2 = routeWkt         (used for ST_LineLocatePoint)
 * $3 = radiusMeters
 */
export async function findNearCorridor(
  corridorGeoJson: string,
  routeWkt: string,
  radiusMeters: number
): Promise<ParkingFacilityNearRoute[]> {
  const client = await pool.connect();
  try {
    const res = await client.query<NearCorridorRow>(
      `SELECT
         pf.id, pf.name, pf.state, pf.highway, pf.direction,
         pf.total_spaces, pf.available_spaces, pf.trend,
         ST_AsGeoJSON(pf.location)::json AS geometry,
         ST_Distance(pf.location::geography, ST_GeomFromGeoJSON($1)::geography) AS distance_from_route,
         ST_LineLocatePoint(
           ST_GeomFromText($2, 4326),
           pf.location
         ) AS position_along_route
       FROM parking_facilities pf
       WHERE pf.is_active = true
         AND ST_DWithin(pf.location::geography, ST_GeomFromGeoJSON($1)::geography, $3)
       ORDER BY position_along_route
       LIMIT 50`,
      [corridorGeoJson, routeWkt, radiusMeters]
    );

    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      state: row.state,
      highway: row.highway,
      direction: row.direction,
      total_spaces: row.total_spaces,
      available_spaces: row.available_spaces,
      trend: row.trend,
      distance_from_route: Number(row.distance_from_route),
      position_along_route: Number(row.position_along_route),
      geometry: row.geometry,
    }));
  } finally {
    client.release();
  }
}
