import { type NextRequest, NextResponse } from "next/server";
import { geocodeSuggestions } from "@/lib/geo/geocode";
import type { GeocodingSuggestion } from "@/lib/types/route";

export async function GET(req: NextRequest): Promise<NextResponse> {
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
