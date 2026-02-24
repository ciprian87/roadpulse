import { createHash } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geo/geocode";
import { fetchRoute } from "@/lib/geo/route";
import { buildCorridor } from "@/lib/geo/corridor";
import { findHazardsInCorridor } from "@/lib/geo/intersect";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import type { RouteCheckRequest, RouteCheckResponse, RouteHazard } from "@/lib/types/route";

const CACHE_TTL_SECONDS = 300;

function buildSummary(hazards: RouteHazard[]): RouteCheckResponse["summary"] {
  return {
    totalHazards: hazards.length,
    criticalCount: hazards.filter(
      (h) => h.severity === "CRITICAL" || h.severity === "Extreme"
    ).length,
    warningCount: hazards.filter(
      (h) => h.severity === "WARNING" || h.severity === "Severe"
    ).length,
    advisoryCount: hazards.filter(
      (h) => h.severity === "ADVISORY" || h.severity === "Moderate"
    ).length,
    infoCount: hazards.filter(
      (h) => h.severity === "INFO" || h.severity === "Minor"
    ).length,
    roadEventCount: hazards.filter((h) => h.kind === "road_event").length,
    weatherAlertCount: hazards.filter((h) => h.kind === "weather_alert").length,
  };
}

async function handleCheck(params: {
  originAddress: string;
  originLat?: number;
  originLng?: number;
  destinationAddress: string;
  destinationLat?: number;
  destinationLng?: number;
  corridorMiles: number;
}): Promise<NextResponse> {
  const {
    originAddress,
    destinationAddress,
    corridorMiles,
  } = params;

  // Geocode if coordinates not provided
  let oLat = params.originLat;
  let oLng = params.originLng;
  let resolvedOrigin = originAddress;

  if (oLat === undefined || oLng === undefined) {
    try {
      const geo = await geocodeAddress(originAddress);
      oLat = geo.lat;
      oLng = geo.lng;
      resolvedOrigin = geo.address;
    } catch (err: unknown) {
      const code = err instanceof Error && err.message === "GEOCODE_NO_RESULTS"
        ? "GEOCODE_NO_RESULTS"
        : "GEOCODE_ERROR";
      return NextResponse.json(
        { error: `Could not geocode origin: ${originAddress}`, code },
        { status: code === "GEOCODE_NO_RESULTS" ? 404 : 500 }
      );
    }
  }

  let dLat = params.destinationLat;
  let dLng = params.destinationLng;
  let resolvedDestination = destinationAddress;

  if (dLat === undefined || dLng === undefined) {
    try {
      const geo = await geocodeAddress(destinationAddress);
      dLat = geo.lat;
      dLng = geo.lng;
      resolvedDestination = geo.address;
    } catch (err: unknown) {
      const code = err instanceof Error && err.message === "GEOCODE_NO_RESULTS"
        ? "GEOCODE_NO_RESULTS"
        : "GEOCODE_ERROR";
      return NextResponse.json(
        { error: `Could not geocode destination: ${destinationAddress}`, code },
        { status: code === "GEOCODE_NO_RESULTS" ? 404 : 500 }
      );
    }
  }

  // Cache key — short hash of the resolved coordinates + corridor radius
  const cacheKey =
    "route:check:" +
    createHash("sha256")
      .update(`${oLat}:${oLng}:${dLat}:${dLng}:${corridorMiles}`)
      .digest("hex")
      .slice(0, 16);

  const cached = await cacheGet(cacheKey).catch(() => null);
  if (cached) {
    return NextResponse.json<RouteCheckResponse>(JSON.parse(cached));
  }

  // Fetch route from ORS
  let routeResult;
  try {
    routeResult = await fetchRoute(oLat, oLng, dLat, dLng);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "INTERNAL_ERROR";
    if (msg === "ORS_RATE_LIMIT") {
      return NextResponse.json(
        { error: "Route service rate limit exceeded", code: "ORS_RATE_LIMIT", retryAfter: 60 },
        { status: 429 }
      );
    }
    if (msg === "ROUTE_NOT_FOUND") {
      return NextResponse.json(
        { error: "No route found between those locations", code: "ROUTE_NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: msg, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }

  // Build 10-mile corridor polygon in PostGIS
  let corridorResult;
  try {
    corridorResult = await buildCorridor(routeResult.geometryWkt, corridorMiles);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "CORRIDOR_BUILD_FAILED";
    return NextResponse.json(
      { error: msg, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }

  // Intersect corridor with active hazards
  let hazards;
  try {
    hazards = await findHazardsInCorridor(
      corridorResult.geometryGeoJson,
      routeResult.geometryWkt
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json(
      { error: msg, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }

  const response: RouteCheckResponse = {
    route: {
      originAddress: resolvedOrigin,
      originLat: oLat,
      originLng: oLng,
      destinationAddress: resolvedDestination,
      destinationLat: dLat,
      destinationLng: dLng,
      distanceMeters: routeResult.distanceMeters,
      durationSeconds: routeResult.durationSeconds,
      geometry: routeResult.geometry,
      corridorGeometry: corridorResult.geometry,
    },
    hazards,
    summary: buildSummary(hazards),
    checkedAt: new Date().toISOString(),
  };

  // Cache non-fatally — a Redis outage should not fail a successful route check
  await cacheSet(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS).catch(() => undefined);

  return NextResponse.json<RouteCheckResponse>(response);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "MISSING_INPUTS" },
      { status: 400 }
    );
  }

  const data = body as Partial<RouteCheckRequest>;
  const originAddress = data.originAddress?.trim() ?? "";
  const destinationAddress = data.destinationAddress?.trim() ?? "";

  if (!originAddress || !destinationAddress) {
    return NextResponse.json(
      { error: "originAddress and destinationAddress are required", code: "MISSING_INPUTS" },
      { status: 400 }
    );
  }

  const corridorMiles = data.corridorMiles ?? 10;
  if (corridorMiles < 1 || corridorMiles > 50) {
    return NextResponse.json(
      { error: "corridorMiles must be between 1 and 50", code: "INVALID_CORRIDOR" },
      { status: 400 }
    );
  }

  return handleCheck({
    originAddress,
    originLat: typeof data.originLat === "number" ? data.originLat : undefined,
    originLng: typeof data.originLng === "number" ? data.originLng : undefined,
    destinationAddress,
    destinationLat: typeof data.destinationLat === "number" ? data.destinationLat : undefined,
    destinationLng: typeof data.destinationLng === "number" ? data.destinationLng : undefined,
    corridorMiles,
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const p = req.nextUrl.searchParams;
  const originAddress = (p.get("origin") ?? "").trim();
  const destinationAddress = (p.get("dest") ?? "").trim();

  if (!originAddress || !destinationAddress) {
    return NextResponse.json(
      { error: "origin and dest query params are required", code: "MISSING_INPUTS" },
      { status: 400 }
    );
  }

  const rawMiles = p.get("miles");
  const corridorMiles = rawMiles ? parseFloat(rawMiles) : 10;
  if (isNaN(corridorMiles) || corridorMiles < 1 || corridorMiles > 50) {
    return NextResponse.json(
      { error: "miles must be between 1 and 50", code: "INVALID_CORRIDOR" },
      { status: 400 }
    );
  }

  const rawOLat = p.get("origin_lat");
  const rawOLng = p.get("origin_lng");
  const rawDLat = p.get("dest_lat");
  const rawDLng = p.get("dest_lng");

  return handleCheck({
    originAddress,
    originLat: rawOLat ? parseFloat(rawOLat) : undefined,
    originLng: rawOLng ? parseFloat(rawOLng) : undefined,
    destinationAddress,
    destinationLat: rawDLat ? parseFloat(rawDLat) : undefined,
    destinationLng: rawDLng ? parseFloat(rawDLng) : undefined,
    corridorMiles,
  });
}
