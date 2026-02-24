import { redis } from "@/lib/cache/redis";

const WINDOW_SECONDS = 3600; // 1 hour sliding window
const MAX_REPORTS = 10;

/**
 * Returns true if the user may submit another report, false if they've hit
 * the 10-per-hour cap. Uses Redis INCR so the check+increment is atomic.
 * Fails open if Redis is unavailable so drivers can still report.
 */
export async function checkReportRateLimit(userId: string): Promise<boolean> {
  const key = `rate:reports:${userId}`;
  try {
    const count = await redis.incr(key);
    // Set TTL on the first increment only — subsequent increments preserve the
    // existing expiry so the window is fixed (not sliding).
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
    return count <= MAX_REPORTS;
  } catch {
    // Redis unavailable — fail open
    return true;
  }
}
