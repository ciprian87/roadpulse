import { NextRequest, NextResponse } from "next/server";
import { ingestWeatherAlerts } from "@/lib/ingestion/weather-ingest";

interface IngestRequestBody {
  feed: string;
}

interface IngestResponse {
  feed: string;
  result: {
    upserted: number;
    deactivated: number;
    fetchMs: number;
    total: number;
  };
  timestamp: string;
}

// POST /api/admin/ingest
// Manually triggers a feed ingestion run. Useful for testing and development.
// No auth required in Phase 1 — add NextAuth protection before going to production.
export async function POST(
  request: NextRequest
): Promise<
  NextResponse<IngestResponse | { error: string; code: string; details?: unknown }>
> {
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

  if (feed !== "nws-alerts") {
    return NextResponse.json(
      { error: `Unknown feed: ${feed}`, code: "UNKNOWN_FEED" },
      { status: 400 }
    );
  }

  try {
    const result = await ingestWeatherAlerts();
    return NextResponse.json({
      feed,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Ingestion failed", code: "INGEST_ERROR", details: message },
      { status: 500 }
    );
  }
}
