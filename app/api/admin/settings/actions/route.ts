import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { getAdminSession } from "@/lib/admin/auth-guard";
import { logUsageEvent } from "@/lib/admin/usage-repository";
import { pool } from "@/lib/db";

type MaintenanceAction =
  | "purge_expired_reports"
  | "purge_old_ingestion_logs"
  | "purge_old_usage_events";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await getAdminSession();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { action } = body as { action?: string };

  const client = await pool.connect();
  try {
    let affected = 0;
    let description = "";

    if (action === "purge_expired_reports") {
      const result = await client.query<{ id: string }>(
        `DELETE FROM community_reports
         WHERE is_active = false
           AND (expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '7 days')
         RETURNING id`
      );
      affected = result.rowCount ?? 0;
      description = `Purged ${affected} expired community reports`;
    } else if (action === "purge_old_ingestion_logs") {
      const result = await client.query<{ id: string }>(
        `DELETE FROM ingestion_logs WHERE created_at < NOW() - INTERVAL '30 days' RETURNING id`
      );
      affected = result.rowCount ?? 0;
      description = `Purged ${affected} old ingestion log entries`;
    } else if (action === "purge_old_usage_events") {
      const result = await client.query<{ id: string }>(
        `DELETE FROM usage_events WHERE created_at < NOW() - INTERVAL '90 days' RETURNING id`
      );
      affected = result.rowCount ?? 0;
      description = `Purged ${affected} old usage events`;
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}`, code: "INVALID_ACTION" },
        { status: 400 }
      );
    }

    await logUsageEvent(
      "MAINTENANCE",
      { action: action as MaintenanceAction, affected, description },
      session?.user?.id ?? null
    ).catch(() => undefined);

    return NextResponse.json({ success: true, affected, description });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "ACTION_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    client.release();
  }
}
