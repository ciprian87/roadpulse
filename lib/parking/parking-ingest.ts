import { fetchStaticFeed, fetchDynamicFeed } from "./tpims";
import { upsertFacilities, type ParkingUpsertRow } from "./parking-repository";

export interface ParkingIngestResult {
  upserted: number;
  fetchMs: number;
}

/**
 * Fetch static + dynamic TPIMS feeds, merge on facilityId, and upsert all
 * matched facilities into parking_facilities.
 *
 * Unmatched static facilities (no dynamic status yet) are still upserted with
 * null available_spaces so the facility appears on the map.
 */
export async function ingestParking(): Promise<ParkingIngestResult> {
  const startMs = Date.now();

  const [staticFacilities, dynamicStatuses] = await Promise.all([
    fetchStaticFeed(),
    fetchDynamicFeed(),
  ]);

  // Index dynamic statuses by facilityId for O(1) merge
  const dynamicByFacilityId = new Map(
    dynamicStatuses.map((s) => [s.facilityId, s])
  );

  const rows: ParkingUpsertRow[] = staticFacilities.map((facility) => {
    const dynamic = dynamicByFacilityId.get(facility.facilityId);
    return {
      source: "tpims",
      source_facility_id: facility.facilityId,
      name: facility.name,
      state: facility.state,
      highway: facility.highway,
      direction: facility.direction,
      latitude: facility.latitude,
      longitude: facility.longitude,
      total_spaces: facility.totalSpaces,
      available_spaces: dynamic?.availableSpaces ?? null,
      trend: dynamic?.trend ?? null,
      amenities: facility.amenities,
      last_updated_at: dynamic?.lastUpdated ?? null,
    };
  });

  const upserted = await upsertFacilities(rows);
  const fetchMs = Date.now() - startMs;

  return { upserted, fetchMs };
}
