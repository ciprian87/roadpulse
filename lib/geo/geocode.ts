import type { GeocodingSuggestion } from "@/lib/types/route";

const ORS_BASE = "https://api.openrouteservice.org";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/** Returns up to 5 US address suggestions from the ORS Pelias geocoder. */
export async function geocodeSuggestions(text: string): Promise<GeocodingSuggestion[]> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) throw new Error("OPENROUTESERVICE_API_KEY is not set");

  const url =
    `${ORS_BASE}/geocode/search` +
    `?api_key=${encodeURIComponent(apiKey)}` +
    `&text=${encodeURIComponent(text)}` +
    `&size=5&boundary.country=US`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`ORS geocode error: ${res.status}`);

  const data = (await res.json()) as {
    features?: Array<{
      geometry: { coordinates: [number, number] };
      properties: { label?: string; name?: string };
    }>;
  };

  return (data.features ?? []).map((f) => ({
    label: f.properties.label ?? f.properties.name ?? "Unknown",
    // ORS returns [lng, lat] — flip to lat/lng for consistency
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));
}

/**
 * Resolves a free-text address to a single coordinate.
 * Tries ORS first; falls back to Nominatim if ORS returns zero results.
 * Throws "GEOCODE_NO_RESULTS" when both sources return nothing.
 */
export async function geocodeAddress(
  text: string
): Promise<{ address: string; lat: number; lng: number }> {
  // ORS first
  try {
    const suggestions = await geocodeSuggestions(text);
    if (suggestions.length > 0) {
      const first = suggestions[0]!;
      return { address: first.label, lat: first.lat, lng: first.lng };
    }
  } catch {
    // Fall through to Nominatim
  }

  // Nominatim fallback — use the NWS_USER_AGENT value as a polite user-agent
  const url =
    `${NOMINATIM_BASE}/search` +
    `?q=${encodeURIComponent(text)}` +
    `&format=jsonv2&limit=1&countrycodes=us`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": process.env.NWS_USER_AGENT ?? "RoadPulse/1.0",
    },
  });

  if (!res.ok) throw new Error("GEOCODE_NO_RESULTS");

  const results = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  if (results.length === 0) throw new Error("GEOCODE_NO_RESULTS");

  const r = results[0]!;
  return {
    address: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  };
}
