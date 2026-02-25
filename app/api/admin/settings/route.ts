import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { getAdminSession } from "@/lib/admin/auth-guard";
import { getAllSettings, setSetting } from "@/lib/admin/settings-repository";
import { logUsageEvent } from "@/lib/admin/usage-repository";

export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const settings = await getAllSettings();
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await getAdminSession();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const updates = body as Record<string, unknown>;
  if (typeof updates !== "object" || Array.isArray(updates) || updates === null) {
    return NextResponse.json(
      { error: "Body must be a key-value object", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  try {
    for (const [key, value] of Object.entries(updates)) {
      await setSetting(key, value, session?.user?.id ?? undefined);
    }
    await logUsageEvent(
      "SETTINGS_UPDATE",
      { keys: Object.keys(updates) },
      session?.user?.id ?? null
    ).catch(() => undefined);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "UPDATE_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
