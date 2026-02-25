import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { getAnomalies } from "@/lib/admin/data-quality-repository";

export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const anomalies = await getAnomalies();
    return NextResponse.json({ anomalies });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
