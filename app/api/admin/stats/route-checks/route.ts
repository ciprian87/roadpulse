import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { getRouteCheckTimeSeries } from "@/lib/admin/usage-repository";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "7", 10);
  if (isNaN(days) || days < 1 || days > 90) {
    return NextResponse.json({ error: "days must be 1–90", code: "INVALID_PARAMS" }, { status: 400 });
  }

  try {
    const series = await getRouteCheckTimeSeries(days);
    return NextResponse.json({ series });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
