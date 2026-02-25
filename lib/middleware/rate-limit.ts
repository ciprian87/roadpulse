import { redis } from "@/lib/cache/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/**
 * Sliding-window rate limiter backed by Redis INCR + EXPIRE.
 *
 * @param identifier - e.g. "rl:route:1.2.3.4"
 * @param limit       - max requests per window
 * @param windowSeconds - window length in seconds
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const count = await redis.incr(identifier);

  // Set expiry only on the first request so we don't keep resetting the window.
  if (count === 1) {
    await redis.expire(identifier, windowSeconds);
  }

  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  // Approximate retry-after — accurate enough for HTTP headers
  const retryAfter = allowed ? 0 : windowSeconds;

  return { allowed, remaining, retryAfter };
}

/** Extract caller IP from standard proxy headers. Returns "unknown" if absent. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}
