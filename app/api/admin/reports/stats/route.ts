import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { pool } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const [statusResult, typeResult] = await Promise.all([
      client.query<{ moderation_status: string | null; count: string }>(
        `SELECT moderation_status, COUNT(*) AS count
         FROM community_reports
         GROUP BY moderation_status`
      ),
      client.query<{ type: string; count: string }>(
        `SELECT type, COUNT(*) AS count
         FROM community_reports
         WHERE is_active = true
         GROUP BY type
         ORDER BY count DESC`
      ),
    ]);

    const byStatus: Record<string, number> = {};
    for (const r of statusResult.rows) {
      byStatus[r.moderation_status ?? "pending"] = parseInt(r.count, 10);
    }

    const byType = typeResult.rows.map((r) => ({
      type: r.type,
      count: parseInt(r.count, 10),
    }));

    return NextResponse.json({ byStatus, byType });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    client.release();
  }
}
