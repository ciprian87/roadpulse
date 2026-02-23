import { BaseFeedAdapter, type NormalizedRoadEvent } from "@/lib/feeds/base-adapter";

// ── WZDx type definitions ─────────────────────────────────────────────────────

interface WzdxFeedInfo {
  version?: string;
}

// v3+ feature: event details nested under properties.core_details.
// In WZDx v4, road_names is an array; start_date/end_date live at the
// properties level (not inside core_details).
interface WzdxV3CoreDetails {
  data_source_id: string;
  event_type?: string;
  road_names?: string[];  // v4: array of road names
  name?: string;          // v3: single name (kept for backward compat)
  description?: string;
  direction?: string;
  update_date?: string;
}

interface WzdxV3Properties {
  core_details: WzdxV3CoreDetails;
  // v4: dates at properties level (not inside core_details)
  start_date?: string;
  end_date?: string;
  vehicle_impact?: string;
  workers_present?: boolean;
  restrictions?: Array<{ type: string; value?: number; unit?: string }>;
}

interface WzdxV3Feature {
  type: "Feature";
  id?: string;
  geometry: GeoJSON.Geometry | null;
  properties: WzdxV3Properties;
}

// v2 feature: flat properties
interface WzdxV2Properties {
  road_event_id?: string;
  event_type?: string;
  road_name?: string;
  direction?: string;
  start_date?: string;
  end_date?: string;
  update_date?: string;
  vehicle_impact?: string;
  workers_present?: boolean;
  restrictions?: Array<{ type: string; value?: number; unit?: string }>;
  description?: string;
}

interface WzdxV2Feature {
  type: "Feature";
  geometry: GeoJSON.Geometry | null;
  properties: WzdxV2Properties;
}

interface WzdxFeed {
  road_event_feed_info?: WzdxFeedInfo;
  features: (WzdxV3Feature | WzdxV2Feature)[];
}

// ── Severity and type mapping ──────────────────────────────────────────────────

/**
 * Map WZDx vehicle_impact values to RoadPulse severity.
 * The mapping follows the severity system in CLAUDE.md.
 */
function vehicleImpactToSeverity(vehicleImpact: string | null | undefined): string {
  switch (vehicleImpact) {
    case "all-lanes-closed":
      return "CRITICAL";
    case "some-lanes-closed":
    case "alternating-one-way":
    case "merge-left":
    case "merge-right":
      return "WARNING";
    case "shifting-left":
    case "shifting-right":
    case "reduced-speed-zone":
      return "ADVISORY";
    default:
      return "INFO";
  }
}

/** Map WZDx event_type to RoadPulse road event type */
function wzdxEventTypeToType(eventType: string | null | undefined): string {
  switch (eventType) {
    case "work-zone":
      return "CONSTRUCTION";
    case "restriction":
      return "RESTRICTION";
    case "incident":
      return "INCIDENT";
    case "event":
      return "SPECIAL_EVENT";
    default:
      return "CONSTRUCTION";
  }
}

// ── Per-version normalizers ────────────────────────────────────────────────────

function normalizeV3Feature(
  feature: WzdxV3Feature,
  feedUrl: string,
  state: string,
  source: string
): NormalizedRoadEvent | null {
  if (!feature.geometry) return null;

  const cd = feature.properties.core_details;

  // Some feeds declare a v3+ version number but use a flat (v2-style) property
  // structure with no core_details nesting (e.g. NC DOT v3.1). Fall back to the
  // v2 normalizer when core_details is absent.
  if (!cd) {
    return normalizeV2Feature(feature as unknown as WzdxV2Feature, feedUrl, state, source);
  }

  const vehicleImpact = feature.properties.vehicle_impact ?? null;

  // road_names is an array in v4; fall back to the v3 name field
  const primaryRoadName = cd.road_names?.[0] ?? cd.name ?? null;

  // WZDx v4 GeoJSON features carry an id at the feature level; fall back to a
  // composite key using data_source_id + road name + start_date for v3 feeds that omit it.
  const sourceEventId =
    feature.id?.toString() ??
    `${cd.data_source_id}:${primaryRoadName ?? ""}:${feature.properties.start_date ?? ""}`;

  const eventType = wzdxEventTypeToType(cd.event_type);

  return {
    source,
    source_event_id: sourceEventId,
    state,
    type: eventType,
    severity: vehicleImpactToSeverity(vehicleImpact),
    title: primaryRoadName ?? `${eventType} on ${state}`,
    description: cd.description ?? null,
    direction: cd.direction ?? null,
    route_name: primaryRoadName,
    geometry_geojson: JSON.stringify(feature.geometry),
    location_description: null,
    // v4: start_date/end_date are at properties level, not inside core_details
    started_at: feature.properties.start_date ?? null,
    expected_end_at: feature.properties.end_date ?? null,
    lane_impact:
      vehicleImpact !== null
        ? {
            vehicle_impact: vehicleImpact,
            workers_present: feature.properties.workers_present,
          }
        : null,
    vehicle_restrictions:
      feature.properties.restrictions?.map((r) => ({
        type: r.type,
        value: r.value,
        unit: r.unit,
      })) ?? [],
    detour_description: null,
    source_feed_url: feedUrl,
    raw: feature,
  };
}

function normalizeV2Feature(
  feature: WzdxV2Feature,
  feedUrl: string,
  state: string,
  source: string
): NormalizedRoadEvent | null {
  if (!feature.geometry) return null;

  const props = feature.properties;
  const vehicleImpact = props.vehicle_impact ?? null;

  // v2 uses a flat road_event_id property; fall back to a composite key
  const sourceEventId =
    props.road_event_id ??
    `${props.road_name ?? ""}:${props.start_date ?? ""}`;

  const eventType = wzdxEventTypeToType(props.event_type);

  return {
    source,
    source_event_id: sourceEventId,
    state,
    type: eventType,
    severity: vehicleImpactToSeverity(vehicleImpact),
    title: props.road_name ?? `${eventType} on ${state}`,
    description: props.description ?? null,
    direction: props.direction ?? null,
    route_name: props.road_name ?? null,
    geometry_geojson: JSON.stringify(feature.geometry),
    location_description: null,
    started_at: props.start_date ?? null,
    expected_end_at: props.end_date ?? null,
    lane_impact:
      vehicleImpact !== null
        ? {
            vehicle_impact: vehicleImpact,
            workers_present: props.workers_present,
          }
        : null,
    vehicle_restrictions:
      props.restrictions?.map((r) => ({
        type: r.type,
        value: r.value,
        unit: r.unit,
      })) ?? [],
    detour_description: null,
    source_feed_url: feedUrl,
    raw: feature,
  };
}

// ── Generic WZDx adapter ───────────────────────────────────────────────────────

/**
 * Shared WZDx normalization logic. Detects feed version and delegates to the
 * appropriate per-version normalizer. Concrete subclasses provide the feed
 * identity (feedName, feedUrl, state) and the fetch() implementation.
 */
abstract class WzdxAdapter extends BaseFeedAdapter {
  async fetch(): Promise<string> {
    const response = await fetch(this.feedUrl, {
      // WZDx feeds typically serve as application/json even though the content
      // is GeoJSON. Using application/json avoids 406 rejections from servers
      // that don't advertise geo+json support.
      headers: { Accept: "application/json" },
      // Bypass any local HTTP cache — we manage freshness via Redis
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `WZDx fetch failed for ${this.feedName}: ${response.status} ${response.statusText}`
      );
    }

    return response.text();
  }

  normalize(raw: string): (NormalizedRoadEvent | null)[] {
    // Some servers (e.g. NJ NJIT) double-encode when Accept: application/json is
    // present — JSON.parse returns a string rather than an object. Unwrap one level.
    const once = JSON.parse(raw) as unknown;
    const parsed = (typeof once === "string" ? JSON.parse(once) : once) as WzdxFeed | (WzdxV3Feature | WzdxV2Feature)[];

    // Some feeds (e.g. NJ NJIT) return a bare GeoJSON feature array rather than
    // a FeatureCollection envelope. Normalise both shapes into {features, feedInfo}.
    let features: (WzdxV3Feature | WzdxV2Feature)[];
    let feedInfo: WzdxFeedInfo | undefined;

    if (Array.isArray(parsed)) {
      features = parsed;
      feedInfo = undefined;
    } else {
      features = parsed.features ?? [];
      // Some feeds use feed_info instead of road_event_feed_info (e.g. NJ).
      feedInfo = parsed.road_event_feed_info ??
        (parsed as unknown as Record<string, unknown>)["feed_info"] as WzdxFeedInfo | undefined;
    }

    // Guard: unexpected envelope with no usable feature array
    if (!Array.isArray(features)) {
      throw new Error(`Feed response has no features array for ${this.feedName}`);
    }

    // Version detection: v3+ uses core_details nesting; v2 is flat.
    // Default to v3 since all new feeds target WZDx v4.x.
    const versionStr = feedInfo?.version ?? "3";
    const majorVersion = parseInt(versionStr.split(".")[0] ?? "3", 10);
    const isV3Plus = majorVersion >= 3;

    if (isV3Plus) {
      return (features as WzdxV3Feature[]).map((f) =>
        normalizeV3Feature(f, this.feedUrl, this.state, this.feedName)
      );
    } else {
      return (features as WzdxV2Feature[]).map((f) =>
        normalizeV2Feature(f, this.feedUrl, this.state, this.feedName)
      );
    }
  }
}

// ── Concrete adapters ──────────────────────────────────────────────────────────

export class IowaDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "iowa-wzdx";
  // URL sourced from USDOT WZDx Feed Registry (data.transportation.gov/resource/69qe-yiui)
  // Iowa DOT updates this feed every minute via their ATMS (Advanced Traffic Management System)
  readonly feedUrl = "https://iowa-atms.cloud-q-free.com/api/rest/dataprism/wzdx/wzdxfeed";
  readonly state = "IA";
  readonly cacheTtlSeconds = 300;
}

// ── Additional state adapters — URLs verified from USDOT WZDx DataHub ─────────
// https://data.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Exchange-WZDx-Feed-Registry/69qe-yiui
// All feeds below are publicly accessible without a private API key.

export class NcDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "nc-wzdx";
  // NC DOT via one.network platform — public app_key listed in USDOT DataHub
  readonly feedUrl = "https://us-datacloud.one.network/wzdx-north-carolina.json?app_key=db73336d-85c4-7d0b-258b71e36573";
  readonly state = "NC";
  readonly cacheTtlSeconds = 300;
}

export class MassDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "ma-wzdx";
  readonly feedUrl = "https://feed.massdot-swzm.com/massdot_wzdx_v4.1_work_zone_feed.geojson";
  readonly state = "MA";
  readonly cacheTtlSeconds = 300;
}

export class MnDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "mn-wzdx";
  readonly feedUrl = "https://mn.carsprogram.org/carsapi_v1/api/wzdx";
  readonly state = "MN";
  readonly cacheTtlSeconds = 300;
}

export class WiDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "wi-wzdx";
  readonly feedUrl = "https://511wi.gov/api/wzdx";
  readonly state = "WI";
  readonly cacheTtlSeconds = 300;
}

export class InDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "in-wzdx";
  readonly feedUrl = "https://in.carsprogram.org/carsapi_v1/api/wzdx";
  readonly state = "IN";
  readonly cacheTtlSeconds = 300;
}

export class MoDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "mo-wzdx";
  readonly feedUrl = "https://traveler.modot.org/timconfig/feed/desktop/mo_wzdx.json";
  readonly state = "MO";
  readonly cacheTtlSeconds = 300;
}

export class NyDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "ny-wzdx";
  readonly feedUrl = "https://511ny.org/api/wzdx";
  readonly state = "NY";
  readonly cacheTtlSeconds = 300;
}

export class MdDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "md-wzdx";
  readonly feedUrl = "https://filter.ritis.org/wzdx_v4.1/mdot.geojson";
  readonly state = "MD";
  readonly cacheTtlSeconds = 300;
}

export class WaDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "wa-wzdx";
  readonly feedUrl = "https://wzdx.wsdot.wa.gov/api/v4/WorkZoneFeed";
  readonly state = "WA";
  readonly cacheTtlSeconds = 300;
}

export class UtDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "ut-wzdx";
  readonly feedUrl = "https://udottraffic.utah.gov/wzdx/udot/v40/data";
  readonly state = "UT";
  readonly cacheTtlSeconds = 300;
}

export class KyDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "ky-wzdx";
  readonly feedUrl = "https://storage.googleapis.com/kytc-its-2020-openrecords/public/feeds/WZDx/kytc_wzdx_v4.1.geojson";
  readonly state = "KY";
  readonly cacheTtlSeconds = 300;
}

export class IdDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "id-wzdx";
  readonly feedUrl = "https://511.idaho.gov/api/wzdx";
  readonly state = "ID";
  readonly cacheTtlSeconds = 300;
}

export class NjWzdxAdapter extends WzdxAdapter {
  readonly feedName = "nj-wzdx";
  readonly feedUrl = "https://smartworkzones.njit.edu/nj/wzdx";
  readonly state = "NJ";
  readonly cacheTtlSeconds = 300;
}

export class DeDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "de-wzdx";
  readonly feedUrl = "https://wzdx.e-dot.com/del_dot_feed_wzdx_v4.1.geojson";
  readonly state = "DE";
  readonly cacheTtlSeconds = 300;
}

export class NmDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "nm-wzdx";
  readonly feedUrl = "https://ai.blyncsy.io/wzdx/nmdot/feed";
  readonly state = "NM";
  readonly cacheTtlSeconds = 300;
}

export class LaDotdWzdxAdapter extends WzdxAdapter {
  readonly feedName = "la-wzdx";
  readonly feedUrl = "https://wzdx.e-dot.com/la_dot_d_feed_wzdx_v4.1.geojson";
  readonly state = "LA";
  readonly cacheTtlSeconds = 300;
}

export class KsDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "ks-wzdx";
  readonly feedUrl = "https://ks.carsprogram.org/carsapi_v1/api/wzdx";
  readonly state = "KS";
  readonly cacheTtlSeconds = 300;
}

// ── Phase 4 state adapters — 16 additional states ─────────────────────────────
// URLs verified Feb 2026 against the USDOT WZDx Feed Registry and live endpoints.
// All are publicly accessible without a private API key.

export class OhDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "oh-wzdx";
  // HaulHub/e-dot statewide feed; USDOT registry also lists OhGo API (key required)
  readonly feedUrl = "https://wzdx.e-dot.com/oh_dot_feed_wzdx_v4.1.geojson";
  readonly state = "OH";
  readonly cacheTtlSeconds = 300;
}

export class PaDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "pa-wzdx";
  // PennDOT statewide via 511PA (Arcadis). PA Turnpike has a separate key-required feed.
  readonly feedUrl = "https://511pa.com/api/wzdx";
  readonly state = "PA";
  readonly cacheTtlSeconds = 300;
}

export class VaDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "va-wzdx";
  // HaulHub/e-dot statewide feed; VDOT SmarterRoads API requires a key
  readonly feedUrl = "https://wzdx.e-dot.com/va_feed_wzdx_v4.1.geojson";
  readonly state = "VA";
  readonly cacheTtlSeconds = 300;
}

export class OrDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "or-wzdx";
  readonly feedUrl = "https://wzdx.e-dot.com/or_dot_feed_wzdx_v4.1.geojson";
  readonly state = "OR";
  readonly cacheTtlSeconds = 300;
}

export class MiDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "mi-wzdx";
  // HaulHub/e-dot statewide feed. MDOT's native API requires a key.
  readonly feedUrl = "https://wzdx.e-dot.com/mi_dot_feed_wzdx_v4.1.geojson";
  readonly state = "MI";
  readonly cacheTtlSeconds = 300;
}

export class IlDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "il-wzdx";
  // IDOT statewide via HaulHub; IL Tollway has a separate key-required feed
  readonly feedUrl = "https://wzdx.e-dot.com/il_feed_wzdx_v4.1.geojson";
  readonly state = "IL";
  readonly cacheTtlSeconds = 300;
}

export class FlDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "fl-wzdx";
  // FDOT via one.network (WZDx v4.2, ~4800 features). The app_key is a public
  // embedded key published verbatim in the USDOT Feed Registry — not a secret.
  readonly feedUrl = "https://us-datacloud.one.network/fdot/feed.json?app_key=c4090b04-26de-c9ee-873b2bd9a38c";
  readonly state = "FL";
  readonly cacheTtlSeconds = 300;
}

export class GaDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "ga-wzdx";
  // Georgia 511 portal (Arcadis). Not in USDOT registry but confirmed live.
  readonly feedUrl = "https://511ga.org/api/wzdx";
  readonly state = "GA";
  readonly cacheTtlSeconds = 300;
}

export class TxDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "tx-wzdx";
  // TxDOT statewide via HaulHub; drivetexas.org API requires a key
  readonly feedUrl = "https://wzdx.e-dot.com/tx_dot_feed_wzdx_v4.1.geojson";
  readonly state = "TX";
  readonly cacheTtlSeconds = 300;
}

export class AzDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "az-wzdx";
  // Maricopa County DOT + ADOT highways via AZTech (WZDx v4.2). No key required.
  readonly feedUrl = "https://wzdxapi.aztech.org/construction";
  readonly state = "AZ";
  readonly cacheTtlSeconds = 300;
}

export class MtDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "mt-wzdx";
  readonly feedUrl = "https://wzdx.e-dot.com/mdt_feed_wzdx_v4.1.geojson";
  readonly state = "MT";
  readonly cacheTtlSeconds = 300;
}

export class NeDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "ne-wzdx";
  readonly feedUrl = "https://wzdx.e-dot.com/ne_dot_feed_wzdx_v4.1.geojson";
  readonly state = "NE";
  readonly cacheTtlSeconds = 300;
}

export class WyDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "wy-wzdx";
  readonly feedUrl = "https://wzdx.e-dot.com/wy_dot_feed_wzdx_v4.1.geojson";
  readonly state = "WY";
  readonly cacheTtlSeconds = 300;
}

export class NhDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "nh-wzdx";
  readonly feedUrl = "https://wzdx.e-dot.com/nh_dot_feed_wzdx_v4.1.geojson";
  readonly state = "NH";
  readonly cacheTtlSeconds = 300;
}

export class CtDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "ct-wzdx";
  readonly feedUrl = "https://wzdx.e-dot.com/ct_dot_feed_wzdx_v4.1.geojson";
  readonly state = "CT";
  readonly cacheTtlSeconds = 300;
}

export class TnDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "tn-wzdx";
  readonly feedUrl = "https://wzdx.e-dot.com/tn_feed_wzdx_v4.1.geojson";
  readonly state = "TN";
  readonly cacheTtlSeconds = 300;
}

export class NvDotWzdxAdapter extends WzdxAdapter {
  readonly feedName = "nv-wzdx";
  // Nevada Roads (NDOT via Arcadis) — same platform as WI/ID/NY 511 portals.
  // Not in USDOT registry but confirmed live with 181 features (WZDx v4.1).
  readonly feedUrl = "https://www.nvroads.com/api/wzdx";
  readonly state = "NV";
  readonly cacheTtlSeconds = 300;
}
