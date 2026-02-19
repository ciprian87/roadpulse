import { ingestWeatherAlerts, type IngestResult } from "./weather-ingest";

export interface SchedulerResult {
  feed: string;
  result?: IngestResult;
  error?: string;
}

// Run all registered ingestion jobs sequentially.
// New feeds are added by registering them here — never by modifying individual adapters.
// In production this is called by the /api/cron/ingest route on a schedule.
// In development, trigger it manually via POST /api/admin/ingest or GET /api/cron/ingest.
export async function runAllIngestJobs(): Promise<SchedulerResult[]> {
  const results: SchedulerResult[] = [];

  try {
    const result = await ingestWeatherAlerts();
    results.push({ feed: "nws-alerts", result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ feed: "nws-alerts", error: message });
  }

  return results;
}
