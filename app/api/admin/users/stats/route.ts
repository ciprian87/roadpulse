import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { getUserGrowthSeries, getUserSegments } from "@/lib/admin/user-admin-repository";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);

  try {
    const [growth, segments] = await Promise.all([
      getUserGrowthSeries(Math.min(days, 90)),
      getUserSegments(),
    ]);
    return NextResponse.json({ growth, segments });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
