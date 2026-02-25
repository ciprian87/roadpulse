import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { getAllAdapters } from "@/lib/feeds/feed-registry";
import { ingestWeatherAlerts } from "@/lib/ingestion/weather-ingest";
import { runAllIngestJobs } from "@/lib/ingestion/scheduler";
import { logUsageEvent } from "@/lib/admin/usage-repository";
import { getAdminSession } from "@/lib/admin/auth-guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { name } = await params;
  const session = await getAdminSession();

  try {
    let result;

    if (name === "all") {
      // Delegate to the scheduler which runs feeds sequentially (avoids DB pool
      // exhaustion), respects is_enabled flags, and covers all pipelines (NWS,
      // parking, community expiry, road events).
      const jobs = await runAllIngestJobs();
      const total = jobs.reduce((sum, j) => sum + (j.result?.total ?? 0), 0);
      result = { total, feedCount: jobs.length };
    } else if (name === "nws-alerts") {
      result = await ingestWeatherAlerts();
    } else {
      const adapters = getAllAdapters();
      const adapter = adapters.find((a) => a.feedName === name);
      if (!adapter) {
        return NextResponse.json(
          { error: `No adapter found for feed: ${name}`, code: "NOT_FOUND" },
          { status: 404 }
        );
      }
      result = await adapter.ingest();
    }

    await logUsageEvent(
      "FEED_INGEST",
      { feedName: name, records: result.total, triggeredBy: "admin" },
      session?.user?.id ?? null
    ).catch(() => undefined);

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "INGEST_FAILED";
    return NextResponse.json({ error: msg, code: "INGEST_FAILED" }, { status: 500 });
  }
}
