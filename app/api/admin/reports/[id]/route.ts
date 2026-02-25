import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { getAdminSession } from "@/lib/admin/auth-guard";
import { logUsageEvent } from "@/lib/admin/usage-repository";
import { pool } from "@/lib/db";

const VALID_STATUSES = new Set(["approved", "removed", "pending"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const session = await getAdminSession();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { moderation_status, reason } = body as { moderation_status?: string; reason?: string };

  if (!moderation_status || !VALID_STATUSES.has(moderation_status)) {
    return NextResponse.json(
      { error: "moderation_status must be: approved | removed | pending", code: "INVALID_STATUS" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    const isActive = moderation_status !== "removed";
    await client.query(
      `UPDATE community_reports
       SET moderation_status = $1,
           moderated_by      = $2,
           moderated_at      = NOW(),
           moderation_reason = $3,
           is_active         = $4
       WHERE id = $5`,
      [moderation_status, session?.user?.id ?? null, reason ?? null, isActive, id]
    );

    await logUsageEvent(
      "MODERATION",
      { reportId: id, action: moderation_status, reason },
      session?.user?.id ?? null
    ).catch(() => undefined);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "UPDATE_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    client.release();
  }
}
