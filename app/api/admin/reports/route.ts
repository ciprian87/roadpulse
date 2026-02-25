import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { pool } from "@/lib/db";

interface ReportRow {
  id: string;
  type: string;
  title: string;
  severity: string;
  state: string | null;
  upvotes: number;
  downvotes: number;
  moderation_status: string | null;
  user_email: string | null;
  created_at: string;
  is_active: boolean;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const p = req.nextUrl.searchParams;
  const status = p.get("moderation_status") ?? undefined;
  const limit = Math.min(parseInt(p.get("limit") ?? "50", 10), 200);
  const offset = parseInt(p.get("offset") ?? "0", 10);

  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const args: unknown[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`cr.moderation_status = $${idx++}`);
      args.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await client.query<ReportRow>(
      `SELECT
         cr.id, cr.type, cr.title, cr.severity, cr.state,
         cr.upvotes, cr.downvotes, cr.moderation_status,
         u.email AS user_email,
         cr.created_at::text, cr.is_active
       FROM community_reports cr
       LEFT JOIN users u ON u.id = cr.user_id
       ${where}
       ORDER BY cr.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...args, limit, offset]
    );

    return NextResponse.json({ reports: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    client.release();
  }
}
