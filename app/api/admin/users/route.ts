import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { listUsers } from "@/lib/admin/user-admin-repository";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const p = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(p.get("limit") ?? "50", 10), 200);
  const offset = parseInt(p.get("offset") ?? "0", 10);

  try {
    const result = await listUsers({
      search: p.get("search") ?? undefined,
      role: p.get("role") ?? undefined,
      limit,
      offset,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
