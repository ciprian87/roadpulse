import { pool } from "@/lib/db";
import type {
  RouteHazard,
  RoadEventRouteHazard,
  WeatherAlertRouteHazard,
  CommunityReportRouteHazard,
} from "@/lib/types/route";

// Both NWS and road event severity strings share the same rank scale per CLAUDE.md
const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  Extreme: 4,
  WARNING: 3,
  Severe: 3,
  ADVISORY: 2,
  Moderate: 2,
  INFO: 1,
  Minor: 1,
};

function toSeverityRank(severity: string): number {
  return SEVERITY_RANK[severity] ?? 1;
}

interface RoadEventRow {
  id: string;
  severity: string;
  title: string;
  type: string;
  direction: string | null;
  route_name: string | null;
  description: string | null;
  expected_end_at: string | null;
  lane_impact: unknown;
  vehicle_restrictions: unknown[];
  source: string;
  state: string;
  geometry: GeoJSON.Geometry;
  position_along_route: string;
}

interface WeatherAlertRow {
  id: string;
  severity: string;
  event: string;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  expires: string | null;
  area_description: string;
  geometry: GeoJSON.Geometry;
  position_along_route: string;
}

interface CommunityReportRow {
  id: string;
  type: string;
  title: string;
  severity: string;
  description: string | null;
  location_description: string | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  geometry: GeoJSON.Point;
  position_along_route: string;
}

/**
 * Queries road events and weather alerts that intersect the corridor polygon,
 * then merges and orders them by their position along the route line.
 *
 * $1 = corridorGeoJson (ST_GeomFromGeoJSON)
 * $2 = routeWkt        (ST_GeomFromText / ST_LineLocatePoint)
 */
export async function findHazardsInCorridor(
  corridorGeoJson: string,
  routeWkt: string
): Promise<RouteHazard[]> {
  const client = await pool.connect();
  try {
    const [roadResult, weatherResult, communityResult] = await Promise.all([
      client.query<RoadEventRow>(
        `SELECT
           re.id,
           re.severity,
           re.title,
           re.type,
           re.direction,
           re.route_name,
           re.description,
           re.expected_end_at::text AS expected_end_at,
           re.lane_impact,
           re.vehicle_restrictions,
           re.source,
           re.state,
           ST_AsGeoJSON(re.geometry)::json AS geometry,
           ST_LineLocatePoint(
             ST_GeomFromText($2, 4326),
             ST_Centroid(re.geometry)
           ) AS position_along_route
         FROM road_events re
         WHERE re.is_active = true
           AND (re.expected_end_at IS NULL OR re.expected_end_at > NOW())
           AND ST_Intersects(re.geometry, ST_GeomFromGeoJSON($1))
         LIMIT 200`,
        [corridorGeoJson, routeWkt]
      ),
      client.query<WeatherAlertRow>(
        `SELECT
           wa.id,
           wa.severity,
           wa.event,
           wa.headline,
           wa.description,
           wa.instruction,
           wa.expires::text AS expires,
           wa.area_description,
           ST_AsGeoJSON(wa.geometry)::json AS geometry,
           ST_LineLocatePoint(
             ST_GeomFromText($2, 4326),
             ST_Centroid(wa.geometry)
           ) AS position_along_route
         FROM weather_alerts wa
         WHERE wa.is_active = true
           AND (wa.expires IS NULL OR wa.expires > NOW())
           AND wa.geometry IS NOT NULL
           AND ST_Intersects(wa.geometry, ST_GeomFromGeoJSON($1))
         LIMIT 200`,
        [corridorGeoJson, routeWkt]
      ),
      // Community reports: Points intersected with the corridor polygon.
      // Exclude reports with net votes below -2 (community-flagged as incorrect).
      client.query<CommunityReportRow>(
        `SELECT
           cr.id,
           cr.type,
           cr.title,
           cr.severity,
           cr.description,
           cr.location_description,
           cr.upvotes,
           cr.downvotes,
           cr.created_at::text AS created_at,
           ST_AsGeoJSON(cr.location)::json AS geometry,
           ST_LineLocatePoint(
             ST_GeomFromText($2, 4326),
             cr.location
           ) AS position_along_route
         FROM community_reports cr
         WHERE cr.is_active = true
           AND (cr.expires_at IS NULL OR cr.expires_at > NOW())
           AND (cr.upvotes - cr.downvotes) >= -2
           AND ST_Intersects(cr.location, ST_GeomFromGeoJSON($1))
         LIMIT 100`,
        [corridorGeoJson, routeWkt]
      ),
    ]);

    const roadHazards: RoadEventRouteHazard[] = roadResult.rows.map((row) => ({
      kind: "road_event",
      id: row.id,
      severity: row.severity,
      severityRank: toSeverityRank(row.severity),
      title: row.title,
      positionAlongRoute: Number(row.position_along_route),
      geometry: row.geometry,
      type: row.type,
      direction: row.direction,
      routeName: row.route_name,
      description: row.description,
      expectedEndAt: row.expected_end_at,
      laneImpact: row.lane_impact,
      vehicleRestrictions: row.vehicle_restrictions ?? [],
      source: row.source,
      state: row.state,
    }));

    const weatherHazards: WeatherAlertRouteHazard[] = weatherResult.rows.map((row) => ({
      kind: "weather_alert",
      id: row.id,
      severity: row.severity,
      severityRank: toSeverityRank(row.severity),
      // Weather alerts use the event type as the display title
      title: row.event,
      positionAlongRoute: Number(row.position_along_route),
      geometry: row.geometry,
      event: row.event,
      headline: row.headline,
      description: row.description,
      instruction: row.instruction,
      expires: row.expires,
      areaDescription: row.area_description,
    }));

    const communityHazards: CommunityReportRouteHazard[] = communityResult.rows.map((row) => ({
      kind: "community_report",
      id: row.id,
      severity: row.severity,
      severityRank: toSeverityRank(row.severity),
      title: row.title,
      positionAlongRoute: Number(row.position_along_route),
      geometry: row.geometry,
      reportType: row.type,
      description: row.description,
      locationDescription: row.location_description,
      upvotes: Number(row.upvotes),
      downvotes: Number(row.downvotes),
      reportedAt: row.created_at,
    }));

    const allHazards: RouteHazard[] = [...roadHazards, ...weatherHazards, ...communityHazards];

    // Primary sort: position along route (0=origin → 1=destination)
    // Tie-break: higher severity rank first
    allHazards.sort((a, b) => {
      const posDiff = a.positionAlongRoute - b.positionAlongRoute;
      if (Math.abs(posDiff) > 0.0001) return posDiff;
      return b.severityRank - a.severityRank;
    });

    return allHazards;
  } finally {
    client.release();
  }
}
