/**
 * Severity color mapping — single source of truth for the severity system.
 * Used by map markers, list badges, and the detail panel.
 *
 * NWS weather alert keys (Extreme, Severe, Moderate, Minor) and road event
 * keys (CRITICAL, WARNING, ADVISORY, INFO) share the same hex values per
 * the severity palette in CLAUDE.md.
 */
export const SEVERITY_COLOR: Record<string, string> = {
  // NWS weather alert severity keys
  Extreme: "#ff4d4f",
  Severe: "#ff8c00",
  Moderate: "#ffd000",
  Minor: "#4096ff",
  Unknown: "#8b93a8",
  // Road event severity keys
  CRITICAL: "#ff4d4f",
  WARNING: "#ff8c00",
  ADVISORY: "#ffd000",
  INFO: "#4096ff",
};

/**
 * Tailwind bg-class counterparts for the severity palette.
 * bg-rp-* classes are defined via CSS @theme tokens in globals.css.
 */
export const SEVERITY_BG_CLASS: Record<string, string> = {
  Extreme: "bg-rp-critical",
  Severe: "bg-rp-warning",
  Moderate: "bg-rp-advisory",
  Minor: "bg-rp-info",
  Unknown: "bg-zinc-600",
};

/** NWS urgency/severity → a display-friendly label for the badge */
export function severityLabel(severity: string): string {
  return severity in SEVERITY_COLOR ? severity : "Unknown";
}

/** Resolve a hex color from a severity string, with Unknown fallback */
export function severityToColor(severity: string): string {
  return SEVERITY_COLOR[severity] ?? SEVERITY_COLOR.Unknown;
}
