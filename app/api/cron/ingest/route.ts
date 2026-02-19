import { NextResponse } from "next/server";
import { runAllIngestJobs, type SchedulerResult } from "@/lib/ingestion/scheduler";

interface CronResponse {
  results: SchedulerResult[];
  timestamp: string;
}

// GET /api/cron/ingest — for external cron services (Vercel Cron, cron-job.org, etc.)
// POST /api/cron/ingest — same, for callers that prefer POST for side-effect endpoints
//
// In production, protect this route with a secret header:
//   if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) → 401
export async function GET(): Promise<NextResponse<CronResponse>> {
  const results = await runAllIngestJobs();
  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}

export async function POST(): Promise<NextResponse<CronResponse>> {
  const results = await runAllIngestJobs();
  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}
