import { type NextRequest } from "next/server";
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

/**
 * Validates a parsed bbox array [west, south, east, north] against WGS 84 bounds.
 * Returns an error string on failure, or null when the bbox is valid.
 *
 * Enforcing valid WGS 84 ranges prevents degenerate envelopes from reaching PostGIS
 * and ensures ST_MakeEnvelope always receives meaningful coordinates.
 */
export function validateBbox(parts: number[]): string | null {
  const [west, south, east, north] = parts;
  if (west < -180 || east > 180 || south < -90 || north > 90) {
    return "bbox coordinates out of WGS 84 bounds (lng: -180..180, lat: -90..90)";
  }
  if (south >= north) {
    return "bbox south must be less than north";
  }
  if (west >= east) {
    return "bbox west must be less than east";
  }
  return null;
}

/**
 * Returns true when the request body exceeds maxBytes.
 * Reads Content-Length; returns false (not too large) when the header is absent
 * so we don't accidentally block requests from clients that omit it.
 */
export function isBodyTooLarge(request: NextRequest, maxBytes: number): boolean {
  const len = parseInt(request.headers.get("content-length") ?? "0", 10);
  return isFinite(len) && len > maxBytes;
}

/** Extract caller IP from standard proxy headers. Returns "unknown" if absent.
 *
 * Security: clients can prepend arbitrary IPs to x-forwarded-for, so we take
 * the LAST value (added by our trusted proxy) rather than the first. x-real-ip
 * is preferred where available because trusted proxies (Vercel, nginx) set it
 * and clients cannot spoof it.
 */
export function getClientIp(request: Request): string {
  // x-real-ip is set by trusted proxies and cannot be client-forged
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Take the last address — the one appended by our proxy, not client-supplied
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[parts.length - 1]?.trim() ?? "unknown";
  }
  return "unknown";
}
