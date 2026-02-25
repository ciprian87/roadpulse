import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import type { FeedStatus } from "@/lib/db/schema";

export async function GET(): Promise<NextResponse> {
  const client = await pool.connect();
  try {
    const result = await client.query<FeedStatus>(
      `SELECT * FROM feed_status ORDER BY state NULLS LAST, feed_name`
    );
    return NextResponse.json({ feeds: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    client.release();
  }
}
