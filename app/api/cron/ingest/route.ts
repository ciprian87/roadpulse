import { NextRequest, NextResponse } from "next/server";
import { runAllIngestJobs, type SchedulerResult } from "@/lib/ingestion/scheduler";

interface CronResponse {
  results: SchedulerResult[];
  timestamp: string;
}

type ErrorResponse = { error: string; code: string };

// Verifies the x-cron-secret header matches the CRON_SECRET env var.
// This prevents unauthenticated callers from triggering ingestion and exhausting
// third-party API quotas (OpenRouteService 2000/day, NWS ~1 req/s).
function verifyCronSecret(request: NextRequest): NextResponse<ErrorResponse> | null {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  return null;
}

// GET /api/cron/ingest — for external cron services (Vercel Cron, cron-job.org, etc.)
// POST /api/cron/ingest — same, for callers that prefer POST for side-effect endpoints
//
// Requires: x-cron-secret header matching CRON_SECRET env var.
export async function GET(request: NextRequest): Promise<NextResponse<CronResponse | ErrorResponse>> {
  const denied = verifyCronSecret(request);
  if (denied) return denied;

  const results = await runAllIngestJobs();
  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}

export async function POST(request: NextRequest): Promise<NextResponse<CronResponse | ErrorResponse>> {
  const denied = verifyCronSecret(request);
  if (denied) return denied;

  const results = await runAllIngestJobs();
  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}
