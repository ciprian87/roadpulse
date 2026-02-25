import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { pool } from "@/lib/db";
import { getIngestionHistory } from "@/lib/admin/ingestion-repository";
import type { FeedStatus } from "@/lib/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { name } = await params;
  const client = await pool.connect();
  try {
    const feedResult = await client.query<FeedStatus>(
      "SELECT * FROM feed_status WHERE feed_name = $1",
      [name]
    );
    if (feedResult.rows.length === 0) {
      return NextResponse.json({ error: "Feed not found", code: "NOT_FOUND" }, { status: 404 });
    }
    const logs = await getIngestionHistory(name, 10);
    return NextResponse.json({ feed: feedResult.rows[0], recentLogs: logs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    client.release();
  }
}
