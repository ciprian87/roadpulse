import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

const QUEUE_NAME = "ingestion";
const JOB_NAME = "run-all-feeds";
const REPEATABLE_JOB_KEY = "global-repeat";

// Lazily-created singletons — safe across Next.js hot reloads because Node.js
// module cache is preserved between reloads when the module is imported at the
// top-level (not inside a function). We guard with globalThis to survive
// fast-refresh scenarios where the module IS re-evaluated.
declare global {
  var __ingestionQueue: Queue | undefined;
  var __ingestionRedis: IORedis | undefined;
}

function getRedisConnection(): IORedis {
  if (!globalThis.__ingestionRedis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    globalThis.__ingestionRedis = new IORedis(url, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });
  }
  return globalThis.__ingestionRedis;
}

export function getIngestionQueue(): Queue {
  if (!globalThis.__ingestionQueue) {
    globalThis.__ingestionQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 20,
        attempts: 1,
      } satisfies JobsOptions,
    });
  }
  return globalThis.__ingestionQueue;
}

export interface QueueStatus {
  isPaused: boolean;
  nextRunAt: number | null;   // Unix ms timestamp
  lastRunAt: number | null;   // Unix ms timestamp
  intervalMinutes: number | null;
  activeCount: number;
  waitingCount: number;
}

export async function getQueueStatus(): Promise<QueueStatus> {
  const queue = getIngestionQueue();
  const [paused, active, waiting, repeatables] = await Promise.all([
    queue.isPaused(),
    queue.getActiveCount(),
    queue.getWaitingCount(),
    queue.getRepeatableJobs(),
  ]);

  const repeatable = repeatables.find((j) => j.key.includes(REPEATABLE_JOB_KEY)) ?? repeatables[0] ?? null;
  const intervalMs = repeatable?.every != null ? Number(repeatable.every) : null;
  const nextRunAt = repeatable?.next ?? null;

  // last run: look at most recent completed job
  const completed = await queue.getJobs(["completed"], 0, 0);
  const lastRunAt = completed[0]?.finishedOn ?? null;

  return {
    isPaused: paused,
    nextRunAt,
    lastRunAt: lastRunAt ?? null,
    intervalMinutes: intervalMs !== null ? intervalMs / 60_000 : null,
    activeCount: active,
    waitingCount: waiting,
  };
}

export async function pauseIngestion(): Promise<void> {
  await getIngestionQueue().pause();
}

export async function resumeIngestion(): Promise<void> {
  await getIngestionQueue().resume();
}

export async function triggerImmediate(): Promise<void> {
  await getIngestionQueue().add(JOB_NAME, {}, { priority: 1 });
}

/** Replace the global repeating schedule with a new interval. Idempotent. */
export async function setRepeatInterval(minutes: number): Promise<void> {
  const queue = getIngestionQueue();

  // Remove all existing repeatable jobs before adding the new one
  const existing = await queue.getRepeatableJobs();
  await Promise.all(existing.map((j) => queue.removeRepeatableByKey(j.key)));

  await queue.add(
    JOB_NAME,
    {},
    {
      repeat: {
        every: minutes * 60_000,
        key: REPEATABLE_JOB_KEY,
      },
    }
  );
}
