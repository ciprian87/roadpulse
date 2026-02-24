import { pool } from "@/lib/db";
import type { CorridorResult } from "@/lib/types/route";

/**
 * Builds a corridor polygon by buffering a route LineString using PostGIS.
 *
 * The WKT is cast to geography before buffering so the radius is measured in
 * true meters rather than degrees — critical for accurate mileage at high latitudes.
 */
export async function buildCorridor(
  wkt: string,
  radiusMiles: number
): Promise<CorridorResult> {
  const radiusMeters = radiusMiles * 1609.344;
  const client = await pool.connect();
  try {
    const result = await client.query<{ geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon }>(
      `SELECT ST_AsGeoJSON(
         ST_Buffer(ST_GeomFromText($1, 4326)::geography, $2)::geometry
       )::json AS geojson`,
      [wkt, radiusMeters]
    );
    const geometry = result.rows[0]?.geojson;
    if (!geometry) throw new Error("CORRIDOR_BUILD_FAILED");
    return {
      geometry,
      geometryGeoJson: JSON.stringify(geometry),
    };
  } finally {
    client.release();
  }
}
