import { ingestWeatherAlerts, type IngestResult } from "./weather-ingest";
import { getAllAdapters } from "@/lib/feeds/feed-registry";
import { expireOldReports } from "@/lib/community/report-repository";

export interface SchedulerResult {
  feed: string;
  result?: IngestResult;
  error?: string;
}

// Run all registered ingestion jobs sequentially.
// New feeds are added by registering them in feed-registry.ts — never by
// modifying individual adapters or this file.
// In production this is called by the /api/cron/ingest route on a schedule.
// In development, trigger it manually via POST /api/admin/ingest.
export async function runAllIngestJobs(): Promise<SchedulerResult[]> {
  const results: SchedulerResult[] = [];

  // 1. NWS weather alerts — keeps its own pipeline (not a BaseFeedAdapter)
  try {
    const result = await ingestWeatherAlerts();
    results.push({ feed: "nws-alerts", result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ feed: "nws-alerts", error: message });
  }

  // 2. Community report expiry — deactivate reports past their expires_at timestamp.
  try {
    const expired = await expireOldReports();
    results.push({ feed: "community-reports-expiry", result: { upserted: 0, deactivated: expired, purged: 0, fetchMs: 0, total: expired } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ feed: "community-reports-expiry", error: message });
  }

  // 3. Road event feed adapters — sequential to avoid DB pool exhaustion.
  // Each adapter catches and records its own failure in feed_status, so a
  // single feed going down does not abort the remaining adapters.
  for (const adapter of getAllAdapters()) {
    try {
      const result = await adapter.ingest();
      results.push({ feed: adapter.feedName, result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ feed: adapter.feedName, error: message });
    }
  }

  return results;
}
