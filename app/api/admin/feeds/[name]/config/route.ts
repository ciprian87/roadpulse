import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminSession } from "@/lib/admin/auth-guard";
import { pool } from "@/lib/db";
import { logUsageEvent } from "@/lib/admin/usage-repository";

interface FeedConfigBody {
  is_enabled?: boolean;
  refresh_interval_minutes?: number;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await getAdminSession();
  const userId = session?.user?.id ?? null;
  const { name } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const update = body as FeedConfigBody;

  // Build the SET clause dynamically from the fields provided
  const setClauses: string[] = [];
  const values: unknown[] = [name]; // $1 = feed_name for WHERE

  if (typeof update.is_enabled === "boolean") {
    setClauses.push(`is_enabled = $${values.length + 1}`);
    values.push(update.is_enabled);
  }

  if (typeof update.refresh_interval_minutes === "number" && update.refresh_interval_minutes >= 1) {
    setClauses.push(`refresh_interval_minutes = $${values.length + 1}`);
    values.push(update.refresh_interval_minutes);
  }

  if (setClauses.length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE feed_status SET ${setClauses.join(", ")} WHERE feed_name = $1 RETURNING feed_name`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Feed not found", code: "NOT_FOUND" }, { status: 404 });
    }

    await logUsageEvent(
      "FEED_CONFIG_UPDATE",
      { feedName: name, changes: update },
      userId
    ).catch(() => undefined);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "UPDATE_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    client.release();
  }
}
