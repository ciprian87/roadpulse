// Next.js instrumentation hook — runs once when the server process starts.
// Dynamic imports keep all BullMQ / Node.js-only code out of the edge runtime.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startIngestionWorker } = await import("@/lib/jobs/ingestion-worker");
    const { setRepeatInterval, getIngestionQueue } = await import("@/lib/jobs/ingestion-queue");
    const { getSetting } = await import("@/lib/admin/settings-repository");

    startIngestionWorker();

    // Only schedule if no repeating job already exists — guards against duplicate
    // schedules during Next.js hot reloads in development.
    const queue = getIngestionQueue();
    const existing = await queue.getRepeatableJobs();
    if (existing.length === 0) {
      const minutes = await getSetting<number>("feed_default_interval_minutes", 5);
      await setRepeatInterval(minutes);
    }
  }
}
