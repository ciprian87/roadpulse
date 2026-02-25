import { pool } from "@/lib/db";
import type { CommunityReportApiItem, CommunityReportType } from "@/lib/types/community";
import { REPORT_EXPIRY_HOURS as EXPIRY } from "@/lib/types/community";

// ── US bounding box ─────────────────────────────────────────────────────────
const US_BOUNDS = { minLat: 17, maxLat: 72, minLng: -180, maxLng: -65 };

export function isWithinUS(lat: number, lng: number): boolean {
  return (
    lat >= US_BOUNDS.minLat &&
    lat <= US_BOUNDS.maxLat &&
    lng >= US_BOUNDS.minLng &&
    lng <= US_BOUNDS.maxLng
  );
}

// ── Row shape returned by SELECT queries ────────────────────────────────────
interface ReportRow {
  id: string;
  user_id: string | null;
  type: CommunityReportType;
  title: string;
  description: string | null;
  geometry: GeoJSON.Point;
  location_description: string | null;
  route_name: string | null;
  state: string | null;
  severity: string;
  upvotes: number;
  downvotes: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

function rowToApiItem(row: ReportRow, userVote?: "up" | "down" | null): CommunityReportApiItem {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    description: row.description,
    geometry: row.geometry,
    location_description: row.location_description,
    route_name: row.route_name,
    state: row.state,
    severity: row.severity,
    upvotes: Number(row.upvotes),
    downvotes: Number(row.downvotes),
    is_active: row.is_active,
    expires_at: row.expires_at,
    created_at: row.created_at,
    user_vote: userVote ?? null,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export interface ListReportsParams {
  state?: string;
  type?: string;
  bbox?: string; // "west,south,east,north"
  limit?: number;
  offset?: number;
  /** If provided, attaches the user's vote status to each report */
  userId?: string;
}

export async function listReports(params: ListReportsParams): Promise<CommunityReportApiItem[]> {
  const limit = Math.min(params.limit ?? 100, 500);
  const offset = params.offset ?? 0;

  const conditions: string[] = [
    "cr.is_active = true",
    "(cr.expires_at IS NULL OR cr.expires_at > NOW())",
    // Exclude reports the community has flagged as wrong (net -3 or worse)
    "(cr.upvotes - cr.downvotes) >= -2",
  ];
  const queryParams: unknown[] = [];
  let idx = 1;

  if (params.state) {
    conditions.push(`cr.state = $${idx++}`);
    queryParams.push(params.state.toUpperCase());
  }

  if (params.type) {
    conditions.push(`cr.type = $${idx++}`);
    queryParams.push(params.type.toUpperCase());
  }

  if (params.bbox) {
    const [west, south, east, north] = params.bbox.split(",").map(Number);
    conditions.push(
      `ST_Intersects(cr.location, ST_MakeEnvelope($${idx++}, $${idx++}, $${idx++}, $${idx++}, 4326))`
    );
    queryParams.push(west, south, east, north);
  }

  const where = conditions.join(" AND ");
  queryParams.push(limit, offset);

  const result = await pool.query<ReportRow>(
    `SELECT
       cr.id, cr.user_id, cr.type, cr.title, cr.description,
       ST_AsGeoJSON(cr.location)::json AS geometry,
       cr.location_description, cr.route_name, cr.state, cr.severity,
       cr.upvotes, cr.downvotes, cr.is_active,
       cr.expires_at::text AS expires_at,
       cr.created_at::text AS created_at
     FROM community_reports cr
     WHERE ${where}
     ORDER BY cr.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    queryParams
  );

  if (!params.userId || result.rows.length === 0) {
    return result.rows.map((r) => rowToApiItem(r));
  }

  // Attach user's vote to each report in a single query
  const votes = await getUserVotes(params.userId, result.rows.map((r) => r.id));
  return result.rows.map((r) => rowToApiItem(r, votes[r.id]));
}

export interface CreateReportData {
  type: CommunityReportType;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  location_description?: string;
  route_name?: string;
  state?: string;
  severity: string;
}

export async function createReport(
  userId: string,
  data: CreateReportData
): Promise<CommunityReportApiItem> {
  const expiryHours = EXPIRY[data.type];
  const result = await pool.query<ReportRow>(
    `INSERT INTO community_reports
       (user_id, type, title, description, location, location_description, route_name, state, severity, expires_at)
     VALUES
       ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9, $10,
        NOW() + ($11 * INTERVAL '1 hour'))
     RETURNING
       id, user_id, type, title, description,
       ST_AsGeoJSON(location)::json AS geometry,
       location_description, route_name, state, severity,
       upvotes, downvotes, is_active,
       expires_at::text AS expires_at,
       created_at::text AS created_at`,
    [
      userId,
      data.type,
      data.title.trim(),
      data.description?.trim() ?? null,
      data.lng, // GeoJSON = [lng, lat]
      data.lat,
      data.location_description?.trim() ?? null,
      data.route_name?.trim() ?? null,
      data.state?.toUpperCase() ?? null,
      data.severity,
      expiryHours,
    ]
  );

  if (!result.rows[0]) throw new Error("Report insert returned no rows");
  return rowToApiItem(result.rows[0]);
}

/**
 * Vote on a report. Rules:
 * - No prior vote: insert vote, increment the matching counter.
 * - Same vote again: remove vote (toggle off), decrement the counter.
 * - Different vote: swap vote, adjust both counters.
 * Returns the updated upvotes/downvotes.
 */
export async function voteOnReport(
  reportId: string,
  userId: string,
  vote: "up" | "down"
): Promise<{ upvotes: number; downvotes: number; user_vote: "up" | "down" | null }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the report row and fetch current vote
    const existing = await client.query<{ vote: string }>(
      `SELECT crv.vote
       FROM community_report_votes crv
       WHERE crv.report_id = $1 AND crv.user_id = $2
       FOR UPDATE`,
      [reportId, userId]
    );

    const currentVote = existing.rows[0]?.vote as "up" | "down" | undefined;

    if (currentVote === vote) {
      // Toggle off — remove the vote and decrement
      await client.query(
        "DELETE FROM community_report_votes WHERE report_id = $1 AND user_id = $2",
        [reportId, userId]
      );
      const col = vote === "up" ? "upvotes" : "downvotes";
      await client.query(
        `UPDATE community_reports SET ${col} = GREATEST(0, ${col} - 1) WHERE id = $1`,
        [reportId]
      );
    } else if (currentVote) {
      // Swap — update vote, decrement old counter, increment new counter
      await client.query(
        "UPDATE community_report_votes SET vote = $1 WHERE report_id = $2 AND user_id = $3",
        [vote, reportId, userId]
      );
      const dec = currentVote === "up" ? "upvotes" : "downvotes";
      const inc = vote === "up" ? "upvotes" : "downvotes";
      await client.query(
        `UPDATE community_reports
         SET ${dec} = GREATEST(0, ${dec} - 1), ${inc} = ${inc} + 1
         WHERE id = $1`,
        [reportId]
      );
    } else {
      // New vote
      await client.query(
        "INSERT INTO community_report_votes (report_id, user_id, vote) VALUES ($1, $2, $3)",
        [reportId, userId, vote]
      );
      const col = vote === "up" ? "upvotes" : "downvotes";
      await client.query(
        `UPDATE community_reports SET ${col} = ${col} + 1 WHERE id = $1`,
        [reportId]
      );
    }

    const updated = await client.query<{ upvotes: number; downvotes: number }>(
      "SELECT upvotes, downvotes FROM community_reports WHERE id = $1",
      [reportId]
    );
    await client.query("COMMIT");

    return {
      upvotes: Number(updated.rows[0]?.upvotes ?? 0),
      downvotes: Number(updated.rows[0]?.downvotes ?? 0),
      user_vote: currentVote === vote ? null : vote,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Returns a map of reportId → user's vote for the given report IDs */
export async function getUserVotes(
  userId: string,
  reportIds: string[]
): Promise<Record<string, "up" | "down">> {
  if (reportIds.length === 0) return {};
  const result = await pool.query<{ report_id: string; vote: "up" | "down" }>(
    "SELECT report_id, vote FROM community_report_votes WHERE user_id = $1 AND report_id = ANY($2)",
    [userId, reportIds]
  );
  return Object.fromEntries(result.rows.map((r) => [r.report_id, r.vote]));
}

/** Mark reports where expires_at < NOW() as inactive. Called by the scheduler. */
export async function expireOldReports(): Promise<number> {
  const result = await pool.query(
    "UPDATE community_reports SET is_active = false WHERE is_active = true AND expires_at < NOW()"
  );
  return result.rowCount ?? 0;
}
