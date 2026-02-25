import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { getRecentActivity } from "@/lib/admin/usage-repository";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10), 100);

  try {
    const events = await getRecentActivity(limit);
    return NextResponse.json({ events });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
