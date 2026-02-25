import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { ingestWeatherAlerts } from "@/lib/ingestion/weather-ingest";
import { runAllIngestJobs, type SchedulerResult } from "@/lib/ingestion/scheduler";
import { getAdapterByName, getAllFeedNames } from "@/lib/feeds/feed-registry";
import type { IngestResult } from "@/lib/ingestion/weather-ingest";

interface IngestRequestBody {
  feed: string;
}

interface SingleIngestResponse {
  feed: string;
  result: IngestResult;
  timestamp: string;
}

interface AllIngestResponse {
  results: SchedulerResult[];
  timestamp: string;
}

// POST /api/admin/ingest
// Manually triggers a feed ingestion run. Useful for testing and development.
// Requires admin role — unauthenticated/non-admin callers receive 401/403.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON", code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || !("feed" in body)) {
    return NextResponse.json(
      { error: "Missing required field: feed", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const { feed } = body as IngestRequestBody;

  // "all" — run every registered feed sequentially
  if (feed === "all") {
    try {
      const results = await runAllIngestJobs();
      return NextResponse.json({ results, timestamp: new Date().toISOString() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Ingestion failed", code: "INGEST_ERROR", details: message },
        { status: 500 }
      );
    }
  }

  // "nws-alerts" — existing NWS pipeline
  if (feed === "nws-alerts") {
    try {
      const result = await ingestWeatherAlerts();
      return NextResponse.json({ feed, result, timestamp: new Date().toISOString() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Ingestion failed", code: "INGEST_ERROR", details: message },
        { status: 500 }
      );
    }
  }

  // Named adapter feeds (e.g. "iowa-wzdx")
  const adapter = getAdapterByName(feed);
  if (adapter) {
    try {
      const result = await adapter.ingest();
      return NextResponse.json({ feed, result, timestamp: new Date().toISOString() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Ingestion failed", code: "INGEST_ERROR", details: message },
        { status: 500 }
      );
    }
  }

  // Unknown feed — list valid names to help the caller
  const validFeeds = ["all", "nws-alerts", ...getAllFeedNames()];
  return NextResponse.json(
    {
      error: `Unknown feed: ${feed}. Valid values: ${validFeeds.join(", ")}`,
      code: "UNKNOWN_FEED",
    },
    { status: 400 }
  );
}
