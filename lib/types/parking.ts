import type GeoJSON from "geojson";

/** Shape returned by the parking API endpoints — matches parking_facilities columns */
export interface ParkingFacilityApiItem {
  id: string;
  source: string;
  source_facility_id: string;
  name: string;
  state: string;
  highway: string | null;
  direction: string | null;
  geometry: GeoJSON.Point; // ST_AsGeoJSON(location)
  total_spaces: number | null;
  available_spaces: number | null;
  /** FILLING | CLEARING | STABLE | null */
  trend: string | null;
  amenities: string[];
  last_updated_at: string | null;
  is_active: boolean;
}

/** Shape returned by findNearCorridor — adds route-relative fields */
export interface ParkingFacilityNearRoute {
  id: string;
  name: string;
  highway: string | null;
  direction: string | null;
  state: string;
  total_spaces: number | null;
  available_spaces: number | null;
  trend: string | null;
  /** Straight-line meters from facility to nearest route point */
  distance_from_route: number;
  /** 0.0 = origin, 1.0 = destination */
  position_along_route: number;
  geometry: GeoJSON.Point;
}

// ── TPIMS feed shapes ─────────────────────────────────────────────────────────

/** One facility record from the TPIMS static feed */
export interface TpimsStaticFacility {
  /** Unique facility identifier in the TPIMS system */
  facilityId: string;
  name: string;
  state: string;
  /** Highway designator, e.g. "I-94" */
  highway: string | null;
  /** "NB" | "SB" | "EB" | "WB" | null */
  direction: string | null;
  latitude: number;
  longitude: number;
  totalSpaces: number | null;
  amenities: string[];
}

/** Dynamic availability record matched to a facility by facilityId */
export interface TpimsDynamicStatus {
  facilityId: string;
  availableSpaces: number | null;
  /** "FILLING" | "CLEARING" | "STABLE" */
  trend: string | null;
  lastUpdated: string | null;
}
