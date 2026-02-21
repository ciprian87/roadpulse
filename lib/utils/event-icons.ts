/**
 * Leaflet DivIcon factory for road event markers.
 * Only imported in client components (MapContainer is ssr:false).
 *
 * Icons follow Lucide's design language: 24×24 viewBox, stroke-width 2,
 * round caps/joins, fill="none". SVG paths are embedded directly into
 * DivIcon HTML strings so no React render step is required.
 *
 * Two icon families:
 *   - createEventIcon(type, severity) → severity-colored circle + Lucide-style symbol
 *   - createClosureEndpointIcon()     → red/white striped barrier for road-closure endpoints
 */
import L from "leaflet";

const SEVERITY_BG: Record<string, string> = {
  CRITICAL: "#ff4d4f",
  WARNING:  "#ff8c00",
  ADVISORY: "#ffd000",
  INFO:     "#4096ff",
};

// ── Lucide-style SVG path groups ───────────────────────────────────────────────
// All icons: viewBox="0 0 24 24", fill="none", stroke="white", stroke-width="2",
// stroke-linecap="round", stroke-linejoin="round"

const SVG_ATTRS = `viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

// TrafficCone — construction / work zone
const CONSTRUCTION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${SVG_ATTRS}>
  <path d="M16.05 10.966a5 2.5 0 0 1-8.1 0"/>
  <path d="m16.923 14.049 4.48 2.04a1 1 0 0 1 .001 1.831l-8.574 3.9a2 2 0 0 1-1.66 0l-8.574-3.91a1 1 0 0 1 0-1.83l4.484-2.04"/>
  <path d="M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z"/>
  <path d="M9.194 6.57a5 2.5 0 0 0 5.61 0"/>
</svg>`;

// OctagonX — full road closure
const CLOSURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${SVG_ATTRS}>
  <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
  <path d="m15 9-6 6"/>
  <path d="m9 9 6 6"/>
</svg>`;

// CircleMinus — restriction / no-entry
const RESTRICTION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${SVG_ATTRS}>
  <circle cx="12" cy="12" r="10"/>
  <path d="M8 12h8"/>
</svg>`;

// TriangleAlert — incident / hazard
const INCIDENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${SVG_ATTRS}>
  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
  <path d="M12 9v4"/>
  <path d="M12 17h.01"/>
</svg>`;

// Snowflake — weather closure
const WEATHER_CLOSURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${SVG_ATTRS}>
  <line x1="2" x2="22" y1="12" y2="12"/>
  <line x1="12" x2="12" y1="2" y2="22"/>
  <path d="m20 16-4-4 4-4"/>
  <path d="m4 8 4 4-4 4"/>
  <path d="m16 4-4 4-4-4"/>
  <path d="m8 20 4-4 4 4"/>
</svg>`;

// Link — chain law / tire chains required
const CHAIN_LAW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${SVG_ATTRS}>
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
</svg>`;

// Flag — special event
const SPECIAL_EVENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${SVG_ATTRS}>
  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
  <line x1="4" x2="4" y1="22" y2="15"/>
</svg>`;

// Construction (default fallback) — Wrench
const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${SVG_ATTRS}>
  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
</svg>`;

function getIconSvg(type: string): string {
  switch (type) {
    case "CONSTRUCTION":    return CONSTRUCTION_SVG;
    case "CLOSURE":         return CLOSURE_SVG;
    case "RESTRICTION":     return RESTRICTION_SVG;
    case "INCIDENT":        return INCIDENT_SVG;
    case "WEATHER_CLOSURE": return WEATHER_CLOSURE_SVG;
    case "CHAIN_LAW":       return CHAIN_LAW_SVG;
    case "SPECIAL_EVENT":   return SPECIAL_EVENT_SVG;
    default:                return DEFAULT_SVG;
  }
}

// ── Icon cache — avoids recreating identical L.DivIcon instances per render ────

const iconCache = new Map<string, L.DivIcon>();
let closureEndpointIconCached: L.DivIcon | null = null;

/**
 * Returns a circular DivIcon with a Lucide-style symbol and severity-colored background.
 * Results are cached by "type:severity" key.
 */
export function createEventIcon(type: string, severity: string): L.DivIcon {
  const cacheKey = `${type}:${severity}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;

  const bg = SEVERITY_BG[severity] ?? "#8b93a8";
  const size = 36;

  const icon = L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background-color:${bg};
      border:2px solid rgba(255,255,255,0.88);
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
    ">${getIconSvg(type)}</div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  iconCache.set(cacheKey, icon);
  return icon;
}

/**
 * Returns a road-barrier DivIcon (red/white diagonal stripes) used to mark
 * the start and end of a fully-closed road segment.
 */
export function createClosureEndpointIcon(): L.DivIcon {
  if (closureEndpointIconCached) return closureEndpointIconCached;

  closureEndpointIconCached = L.divIcon({
    className: "",
    html: `<div style="
      width:40px;height:18px;
      background:repeating-linear-gradient(
        -45deg,
        #ff4d4f,#ff4d4f 5px,
        white 5px,white 10px
      );
      border:2px solid white;
      border-radius:2px;
      box-shadow:0 2px 6px rgba(0,0,0,0.55);
    "></div>`,
    iconSize:   [40, 18],
    iconAnchor: [20, 9],
  });

  return closureEndpointIconCached;
}
