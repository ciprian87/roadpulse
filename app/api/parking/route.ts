import { type NextRequest, NextResponse } from "next/server";
import { listFacilities } from "@/lib/parking/parking-repository";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import type { ParkingFacilityApiItem } from "@/lib/types/parking";

const CACHE_TTL = 120; // 2 minutes

export async function GET(req: NextRequest): Promise<NextResponse> {
  const p = req.nextUrl.searchParams;
  const state = p.get("state") ?? undefined;
  const highway = p.get("highway") ?? undefined;
  const bbox = p.get("bbox") ?? undefined;
  const availableOnly = p.get("available_only") === "true";
  const limitRaw = parseInt(p.get("limit") ?? "100", 10);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 100 : limitRaw), 500);
  const offsetRaw = parseInt(p.get("offset") ?? "0", 10);
  const offset = Math.max(0, isNaN(offsetRaw) ? 0 : offsetRaw);

  const cacheKey = `parking:list:${state ?? ""}:${highway ?? ""}:${bbox ?? ""}:${availableOnly}:${limit}:${offset}`;

  const cached = await cacheGet(cacheKey).catch(() => null);
  if (cached) {
    return NextResponse.json(JSON.parse(cached));
  }

  try {
    const { facilities, total } = await listFacilities({ state, highway, bbox, availableOnly, limit, offset });
    const response: { facilities: ParkingFacilityApiItem[]; total: number } = { facilities, total };
    await cacheSet(cacheKey, JSON.stringify(response), CACHE_TTL).catch(() => undefined);
    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
