import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/index";

export interface ClusterPoint {
  /** GeoJSON Point at the cluster centroid */
  geometry: GeoJSON.Point;
  count: number;
  /** True if any event in the cluster is CRITICAL severity */
  has_critical: boolean;
  /** True if any event in the cluster is WARNING severity */
  has_warning: boolean;
}

interface ClustersResponse {
  clusters: ClusterPoint[];
  zoom: number;
  bbox: string;
}

/**
 * GET /api/events/clusters
 *
 * Returns spatially clustered road event centroids for low-zoom map views.
 * Uses PostGIS ST_ClusterDBSCAN to group nearby events into count-bubbles,
 * dramatically reducing the number of features the client has to render.
 *
 * The eps (cluster radius) scales with zoom so clusters tighten as the user
 * zooms in, providing natural progressive disclosure.
 *
 * Query params:
 *   bbox=west,south,east,north  (required)
 *   zoom=N                       (required, used to derive cluster epsilon)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ClustersResponse | { error: string; code: string }>> {
  const { searchParams } = request.nextUrl;

  const bbox = searchParams.get("bbox");
  const zoom = parseInt(searchParams.get("zoom") ?? "4", 10);

  if (!bbox) {
    return NextResponse.json(
      { error: "bbox is required", code: "MISSING_BBOX" },
      { status: 400 }
    );
  }

  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return NextResponse.json(
      { error: "bbox must be four comma-separated numbers: west,south,east,north", code: "INVALID_BBOX" },
      { status: 400 }
    );
  }

  const [west, south, east, north] = parts;

  // Cluster epsilon in degrees — larger at low zoom (more aggressive clustering),
  // tightens as zoom increases so clusters reveal more local detail.
  // Roughly: zoom 4 ≈ 200km radius, zoom 6 ≈ 50km, zoom 7 ≈ 25km.
  const epsMap: Record<number, number> = {
    4: 2.0,
    5: 1.0,
    6: 0.5,
    7: 0.25,
  };
  const eps = epsMap[zoom] ?? 0.25;

  const client = await pool.connect();
  try {
    const result = await client.query<{
      geometry: Record<string, unknown>;
      count: string;
      has_critical: boolean;
      has_warning: boolean;
    }>(
      // ST_ClusterDBSCAN is a window function and cannot be used directly in
      // GROUP BY. Use a CTE to compute cluster IDs first, then aggregate.
      `WITH clustered AS (
         SELECT
           re.geometry,
           re.severity,
           ST_ClusterDBSCAN(re.geometry, eps := $5, minpoints := 1) OVER () AS cluster_id
         FROM road_events re
         WHERE re.is_active = true
           AND (re.expected_end_at IS NULL OR re.expected_end_at > NOW())
           AND ST_Intersects(re.geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
       )
       SELECT
         ST_AsGeoJSON(ST_Centroid(ST_Collect(geometry)))::json AS geometry,
         COUNT(*)::text AS count,
         bool_or(severity = 'CRITICAL') AS has_critical,
         bool_or(severity = 'WARNING')  AS has_warning
       FROM clustered
       GROUP BY cluster_id`,
      [west, south, east, north, eps]
    );

    const clusters: ClusterPoint[] = result.rows.map((row) => ({
      geometry: row.geometry as unknown as GeoJSON.Point,
      count: parseInt(row.count, 10),
      has_critical: row.has_critical,
      has_warning: row.has_warning,
    }));

    return NextResponse.json({ clusters, zoom, bbox });
  } finally {
    client.release();
  }
}
