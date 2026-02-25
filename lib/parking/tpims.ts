import { cacheGet, cacheSet } from "@/lib/cache/redis";
import type { TpimsStaticFacility, TpimsDynamicStatus } from "@/lib/types/parking";

const STATIC_CACHE_KEY = "tpims:static:cache";
const DYNAMIC_CACHE_KEY = "tpims:dynamic:cache";
const STATIC_TTL = 86_400; // 24 hours — static feed changes infrequently
const DYNAMIC_TTL = 300;   // 5 minutes — availability data changes often

/** Fetch and cache the TPIMS static facility list. Returns [] if env var is unset. */
export async function fetchStaticFeed(): Promise<TpimsStaticFacility[]> {
  const url = process.env.TPIMS_STATIC_URL;
  if (!url) {
    process.stderr.write("[TPIMS] TPIMS_STATIC_URL is not set — skipping static feed\n");
    return [];
  }

  const cached = await cacheGet(STATIC_CACHE_KEY).catch(() => null);
  if (cached) return JSON.parse(cached) as TpimsStaticFacility[];

  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`TPIMS static feed HTTP ${res.status}: ${url}`);
  }

  const raw: unknown = await res.json();
  const facilities = normalizeFacilities(raw);
  await cacheSet(STATIC_CACHE_KEY, JSON.stringify(facilities), STATIC_TTL).catch(() => undefined);
  return facilities;
}

/** Fetch and cache the TPIMS dynamic availability feed. Returns [] if env var is unset. */
export async function fetchDynamicFeed(): Promise<TpimsDynamicStatus[]> {
  const url = process.env.TPIMS_DYNAMIC_URL;
  if (!url) {
    process.stderr.write("[TPIMS] TPIMS_DYNAMIC_URL is not set — skipping dynamic feed\n");
    return [];
  }

  const cached = await cacheGet(DYNAMIC_CACHE_KEY).catch(() => null);
  if (cached) return JSON.parse(cached) as TpimsDynamicStatus[];

  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`TPIMS dynamic feed HTTP ${res.status}: ${url}`);
  }

  const raw: unknown = await res.json();
  const statuses = normalizeStatuses(raw);
  await cacheSet(DYNAMIC_CACHE_KEY, JSON.stringify(statuses), DYNAMIC_TTL).catch(() => undefined);
  return statuses;
}

// ── Normalizers ───────────────────────────────────────────────────────────────
// TPIMS feeds use camelCase JSON. These coerce the raw unknown payload into our
// typed interfaces, dropping any records that are missing required fields.

function normalizeFacilities(raw: unknown): TpimsStaticFacility[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item: unknown): TpimsStaticFacility[] => {
    if (typeof item !== "object" || item === null) return [];
    const r = item as Record<string, unknown>;

    const facilityId = String(r["facilityId"] ?? r["facility_id"] ?? "");
    const lat = Number(r["latitude"] ?? r["lat"] ?? NaN);
    const lng = Number(r["longitude"] ?? r["lon"] ?? r["lng"] ?? NaN);

    if (!facilityId || !isFinite(lat) || !isFinite(lng)) return [];

    return [{
      facilityId,
      name: String(r["name"] ?? r["facilityName"] ?? facilityId),
      state: String(r["state"] ?? r["stateCode"] ?? "").toUpperCase().slice(0, 2),
      highway: r["highway"] != null ? String(r["highway"]) : null,
      direction: r["direction"] != null ? String(r["direction"]).toUpperCase() : null,
      latitude: lat,
      longitude: lng,
      totalSpaces: r["totalSpaces"] != null ? Number(r["totalSpaces"]) : null,
      amenities: Array.isArray(r["amenities"])
        ? (r["amenities"] as unknown[]).map(String)
        : [],
    }];
  });
}

function normalizeStatuses(raw: unknown): TpimsDynamicStatus[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item: unknown): TpimsDynamicStatus[] => {
    if (typeof item !== "object" || item === null) return [];
    const r = item as Record<string, unknown>;

    const facilityId = String(r["facilityId"] ?? r["facility_id"] ?? "");
    if (!facilityId) return [];

    return [{
      facilityId,
      availableSpaces: r["availableSpaces"] != null ? Number(r["availableSpaces"]) : null,
      trend: r["trend"] != null ? String(r["trend"]).toUpperCase() : null,
      lastUpdated: r["lastUpdated"] != null ? String(r["lastUpdated"]) : null,
    }];
  });
}
