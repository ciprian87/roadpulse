import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/index";
import type { RoadEventsApiResponse } from "@/lib/types/road-event";

interface EventRow {
  id: string;
  source: string;
  source_event_id: string;
  state: string;
  type: string;
  severity: string;
  title: string;
  description: string | null;
  direction: string | null;
  route_name: string | null;
  geometry: Record<string, unknown> | null;
  location_description: string | null;
  started_at: Date | null;
  expected_end_at: Date | null;
  last_updated_at: Date | null;
  lane_impact: Record<string, unknown> | null;
  vehicle_restrictions: Record<string, unknown>[];
  detour_description: string | null;
  source_feed_url: string | null;
  is_active: boolean;
  created_at: Date;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<RoadEventsApiResponse | { error: string; code: string }>> {
  const { searchParams } = request.nextUrl;

  const state = searchParams.get("state");
  const type = searchParams.get("type");
  const severity = searchParams.get("severity");
  const bbox = searchParams.get("bbox");
  // active_only defaults to true; pass active_only=false to include inactive events
  const activeOnly = searchParams.get("active_only") !== "false";
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  // Zoom-aware density: fewer, higher-severity events at low zoom where individual
  // road event lines are sub-pixel and impossible to interact with anyway.
  const zoom = parseInt(searchParams.get("zoom") ?? "10", 10);
  const zoomLimit  = zoom < 5 ? 50  : zoom < 8 ? 150 : 500;
  const zoomMinSev = zoom < 5 ? "CRITICAL" : zoom < 8 ? "WARNING" : null;

  // Explicit limit param overrides zoom-derived limit (for non-map callers).
  const limitRaw = parseInt(searchParams.get("limit") ?? String(zoomLimit), 10);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? zoomLimit : limitRaw), 500);

  // Build a dynamic WHERE clause with indexed params.
  // Filter params are kept separate from pagination so the count query can
  // reuse the same array without LIMIT/OFFSET appended.
  const conditions: string[] = [];
  const filterParams: unknown[] = [];
  let paramIdx = 0;

  const addParam = (value: unknown): string => {
    filterParams.push(value);
    return `$${++paramIdx}`;
  };

  if (activeOnly) {
    // Exclude events deactivated by the feed adapter AND events whose
    // expected_end_at has passed — the latter handles the window between
    // an event ending and the next ingest run deactivating it.
    conditions.push(
      "re.is_active = true AND (re.expected_end_at IS NULL OR re.expected_end_at > NOW())"
    );
  }

  // At low zoom levels restrict to the most severe events only.
  // An explicit ?severity= param always wins over the zoom-derived floor.
  if (zoomMinSev && !severity) {
    const sevOrder: Record<string, number> = { CRITICAL: 4, WARNING: 3, ADVISORY: 2, INFO: 1 };
    const minRank = sevOrder[zoomMinSev] ?? 1;
    const allowed = Object.entries(sevOrder)
      .filter(([, rank]) => rank >= minRank)
      .map(([sev]) => sev);
    const p = addParam(allowed);
    conditions.push(`re.severity = ANY(${p}::text[])`);
  }

  if (state) {
    const p = addParam(state.toUpperCase().slice(0, 2));
    conditions.push(`re.state = ${p}`);
  }

  if (type) {
    const p = addParam(type.toUpperCase());
    conditions.push(`re.type = ${p}`);
  }

  if (severity) {
    const p = addParam(severity.toUpperCase());
    conditions.push(`re.severity = ${p}`);
  }

  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return NextResponse.json(
        {
          error: "bbox must be four comma-separated numbers: west,south,east,north",
          code: "INVALID_BBOX",
        },
        { status: 400 }
      );
    }
    const [west, south, east, north] = parts;
    const wp = addParam(west);
    const sp = addParam(south);
    const ep = addParam(east);
    const np = addParam(north);
    // geometry is NOT NULL in road_events schema — no null guard needed
    conditions.push(
      `ST_Intersects(re.geometry, ST_MakeEnvelope(${wp}, ${sp}, ${ep}, ${np}, 4326))`
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const client = await pool.connect();
  try {
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM road_events re ${whereClause}`,
      filterParams
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    const limitIdx = filterParams.length + 1;
    const offsetIdx = filterParams.length + 2;

    const eventsResult = await client.query<EventRow>(
      `SELECT
         re.id, re.source, re.source_event_id, re.state,
         re.type, re.severity, re.title, re.description, re.direction,
         re.route_name, ST_AsGeoJSON(re.geometry)::json AS geometry,
         re.location_description, re.started_at, re.expected_end_at,
         re.last_updated_at, re.lane_impact, re.vehicle_restrictions,
         re.detour_description, re.source_feed_url, re.is_active, re.created_at
       FROM road_events re
       ${whereClause}
       ORDER BY
         CASE re.severity
           WHEN 'CRITICAL' THEN 1
           WHEN 'WARNING'  THEN 2
           WHEN 'ADVISORY' THEN 3
           WHEN 'INFO'     THEN 4
           ELSE 5
         END,
         re.started_at DESC NULLS LAST
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...filterParams, limit, offset]
    );

    return NextResponse.json({
      events: eventsResult.rows as unknown as RoadEventsApiResponse["events"],
      total,
      filters: { state, type, severity, bbox, active_only: activeOnly, limit, offset },
    });
  } finally {
    client.release();
  }
}
