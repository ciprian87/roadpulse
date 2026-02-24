import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/index";

interface AlertRow {
  id: string;
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
  geometry: Record<string, unknown> | null; // pg parses ::json to a JS object
  onset: Date | null;
  expires: Date | null;
  last_updated_at: Date | null;
  sender_name: string | null;
  wind_speed: string | null;
  snow_amount: string | null;
  is_active: boolean;
  created_at: Date;
}

interface AlertsResponse {
  alerts: AlertRow[];
  total: number;
  filters: {
    state: string | null;
    event: string | null;
    severity: string | null;
    bbox: string | null;
    active_only: boolean;
    limit: number;
    offset: number;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<AlertsResponse | { error: string; code: string }>> {
  const { searchParams } = request.nextUrl;

  const state = searchParams.get("state");
  const event = searchParams.get("event");
  const severity = searchParams.get("severity");
  const bbox = searchParams.get("bbox");
  // active_only defaults to true; pass active_only=false to see expired alerts
  const activeOnly = searchParams.get("active_only") !== "false";
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  // Weather alert polygons are large regional features, not dense point markers,
  // so there is no rendering reason to reduce the limit at low zoom.
  // Use a flat 500 cap at all zoom levels; the bbox filter already spatially
  // limits what is returned, and we rarely have more than ~200 active alerts total.
  const zoomLimit  = 500;
  const zoomMinSev = null;

  // Explicit limit param overrides zoom-derived limit (for non-map callers).
  const limitRaw = parseInt(searchParams.get("limit") ?? String(zoomLimit), 10);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? zoomLimit : limitRaw), 500);

  // Build a dynamic WHERE clause using indexed params.
  // Keeping filter params separate from pagination params allows the count
  // query to reuse the same array without the LIMIT/OFFSET appended.
  const conditions: string[] = [];
  const filterParams: unknown[] = [];
  let paramIdx = 0;

  const addParam = (value: unknown): string => {
    filterParams.push(value);
    return `$${++paramIdx}`;
  };

  if (activeOnly) {
    // Exclude alerts that NWS has already marked inactive AND alerts whose
    // expires timestamp has passed — the latter handles the window between
    // an alert expiring and the next ingest run deactivating it in the DB.
    conditions.push("wa.is_active = true AND (wa.expires IS NULL OR wa.expires > NOW())");
  }

  // At very low zoom levels restrict to the most severe alerts only.
  // An explicit ?severity= param always wins over the zoom-derived floor.
  if (zoomMinSev && !severity) {
    const sevOrder: Record<string, number> = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 };
    const minRank = sevOrder[zoomMinSev] ?? 1;
    const allowed = Object.entries(sevOrder)
      .filter(([, rank]) => rank >= minRank)
      .map(([sev]) => sev);
    const p = addParam(allowed);
    conditions.push(`wa.severity = ANY(${p}::text[])`);
  }

  if (state) {
    // Zone IDs start with the 2-letter state abbreviation, e.g. "COZ039" for Colorado.
    const p = addParam(state.toUpperCase().slice(0, 2));
    conditions.push(
      `EXISTS (SELECT 1 FROM unnest(wa.affected_zones) AS z WHERE LEFT(z, 2) = ${p})`
    );
  }

  if (event) {
    const p = addParam(event);
    conditions.push(`wa.event = ${p}`);
  }

  if (severity) {
    const p = addParam(severity);
    conditions.push(`wa.severity = ${p}`);
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
    conditions.push(
      `wa.geometry IS NOT NULL AND ST_Intersects(wa.geometry, ST_MakeEnvelope(${wp}, ${sp}, ${ep}, ${np}, 4326))`
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const client = await pool.connect();
  try {
    // Count query uses only the filter params (no pagination)
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM weather_alerts wa ${whereClause}`,
      filterParams
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    // Data query appends limit/offset after the shared filter params
    const limitIdx = filterParams.length + 1;
    const offsetIdx = filterParams.length + 2;

    const alertsResult = await client.query<AlertRow>(
      `SELECT
         wa.id, wa.nws_id, wa.event, wa.severity, wa.urgency, wa.certainty,
         wa.headline, wa.description, wa.instruction, wa.area_description,
         wa.affected_zones, wa.onset, wa.expires, wa.last_updated_at,
         wa.sender_name, wa.wind_speed, wa.snow_amount, wa.is_active,
         ST_AsGeoJSON(wa.geometry)::json AS geometry,
         wa.created_at
       FROM weather_alerts wa
       ${whereClause}
       ORDER BY wa.onset DESC NULLS LAST
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...filterParams, limit, offset]
    );

    return NextResponse.json({
      alerts: alertsResult.rows,
      total,
      filters: { state, event, severity, bbox, active_only: activeOnly, limit, offset },
    });
  } finally {
    client.release();
  }
}
