import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/index";
import type { RoadEventApiItem } from "@/lib/types/road-event";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<RoadEventApiItem | { error: string; code: string }>> {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "Invalid event ID format", code: "INVALID_ID" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    const result = await client.query<RoadEventApiItem>(
      `SELECT
         re.id, re.source, re.source_event_id, re.state,
         re.type, re.severity, re.title, re.description, re.direction,
         re.route_name, ST_AsGeoJSON(re.geometry)::json AS geometry,
         re.location_description, re.started_at, re.expected_end_at,
         re.last_updated_at, re.lane_impact, re.vehicle_restrictions,
         re.detour_description, re.source_feed_url, re.is_active, re.created_at
       FROM road_events re
       WHERE re.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Road event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0] as unknown as RoadEventApiItem);
  } finally {
    client.release();
  }
}
