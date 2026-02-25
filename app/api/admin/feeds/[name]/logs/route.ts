import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { getIngestionHistory } from "@/lib/admin/ingestion-repository";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { name } = await params;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10);

  try {
    const logs = await getIngestionHistory(name, Math.min(limit, 100));
    return NextResponse.json({ logs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
