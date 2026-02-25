import { type NextRequest, NextResponse } from "next/server";
import { findNearPoint } from "@/lib/parking/parking-repository";

const MILES_TO_METERS = 1609.344;
const DEFAULT_RADIUS_MILES = 25;
const MAX_RADIUS_MILES = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const p = req.nextUrl.searchParams;
  const lat = parseFloat(p.get("lat") ?? "");
  const lng = parseFloat(p.get("lng") ?? "");
  const radiusMiles = parseFloat(p.get("radius") ?? String(DEFAULT_RADIUS_MILES));

  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng are required numeric parameters", code: "MISSING_INPUTS" },
      { status: 400 }
    );
  }

  if (isNaN(radiusMiles) || radiusMiles <= 0 || radiusMiles > MAX_RADIUS_MILES) {
    return NextResponse.json(
      { error: `radius must be between 1 and ${MAX_RADIUS_MILES} miles`, code: "INVALID_RADIUS" },
      { status: 400 }
    );
  }

  const radiusMeters = radiusMiles * MILES_TO_METERS;

  try {
    const facilities = await findNearPoint(lat, lng, radiusMeters);
    return NextResponse.json({ facilities });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
