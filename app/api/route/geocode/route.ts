import { type NextRequest, NextResponse } from "next/server";
import { geocodeSuggestions } from "@/lib/geo/geocode";
import { checkRateLimit, getClientIp } from "@/lib/middleware/rate-limit";
import type { GeocodingSuggestion } from "@/lib/types/route";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 60 requests per minute per IP — protects the ORS free-tier quota (2000/day).
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`rl:geocode:${ip}`, 60, 60).catch(() => ({ allowed: true }));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";

  // Skip the API call for very short inputs — not useful for geocoding
  if (q.length < 3) {
    return NextResponse.json<GeocodingSuggestion[]>([]);
  }

  try {
    const suggestions = await geocodeSuggestions(q);
    return NextResponse.json<GeocodingSuggestion[]>(suggestions);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message, code: "GEOCODE_ERROR" },
      { status: 500 }
    );
  }
}
