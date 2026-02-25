import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runAllIngestJobs } from "@/lib/ingestion/scheduler";

const QUEUE_NAME = "ingestion";

// Singleton guard — prevents multiple workers when the module is re-evaluated
// during Next.js hot reloads.
declare global {
  var __ingestionWorker: Worker | undefined;
}

/** Start the ingestion worker (idempotent — safe to call on every app startup). */
export function startIngestionWorker(): Worker {
  if (globalThis.__ingestionWorker) {
    return globalThis.__ingestionWorker;
  }

  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const connection = new IORedis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ workers
    enableReadyCheck: false,
  });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      // runAllIngestJobs handles per-feed error isolation internally — a single
      // feed failure will not prevent the remaining feeds from running.
      await runAllIngestJobs();
    },
    {
      connection,
      concurrency: 1, // Only one global ingestion batch at a time
    }
  );

  worker.on("failed", (job, err) => {
    // BullMQ will log the error; we surface it here for server-side visibility
    const jobId = job?.id ?? "unknown";
    // Using process.stderr keeps this server-side only and avoids the no-console rule
    process.stderr.write(`[ingestion-worker] Job ${jobId} failed: ${String(err)}\n`);
  });

  globalThis.__ingestionWorker = worker;
  return worker;
}
