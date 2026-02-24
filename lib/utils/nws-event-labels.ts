/**
 * Maps NWS event type strings to plain-English condition labels suitable for
 * display at a glance — the goal is "what is actually happening", not the
 * bureaucratic NWS designation.
 *
 * Cryptic types like "Red Flag Warning" (fire danger) need explicit entries.
 * Transparent types like "Blizzard Warning" are handled by the stripSuffix
 * fallback which removes " Warning / Watch / Advisory / Statement".
 */
const NWS_CONDITION_LABELS: Record<string, string> = {
  // Fire
  "Red Flag Warning": "Fire Danger",
  "Fire Weather Watch": "Fire Danger",
  "Fire Warning": "Fire Danger",

  // Winter / Snow / Ice
  "Winter Storm Warning": "Winter Storm",
  "Winter Storm Watch": "Winter Storm",
  "Winter Weather Advisory": "Winter Weather",
  "Blizzard Warning": "Blizzard",
  "Blizzard Watch": "Blizzard",
  "Ice Storm Warning": "Ice Storm",
  "Freezing Rain Advisory": "Freezing Rain",
  "Freezing Drizzle Advisory": "Freezing Drizzle",
  "Sleet Advisory": "Sleet",
  "Heavy Snow Warning": "Heavy Snow",
  "Lake Effect Snow Warning": "Lake-Effect Snow",
  "Lake Effect Snow Advisory": "Lake-Effect Snow",
  "Lake Effect Snow Watch": "Lake-Effect Snow",
  "Snow Squall Warning": "Snow Squall",

  // Wind chill
  "Wind Chill Warning": "Extreme Wind Chill",
  "Wind Chill Watch": "Wind Chill",
  "Wind Chill Advisory": "Wind Chill",

  // Wind
  "High Wind Warning": "High Winds",
  "High Wind Watch": "High Winds",
  "Wind Advisory": "High Winds",
  "Extreme Wind Warning": "Extreme Winds",
  "Lake Wind Advisory": "Lake Winds",

  // Fog / Smoke / Visibility
  "Dense Fog Advisory": "Dense Fog",
  "Dense Smoke Advisory": "Dense Smoke",
  "Freezing Fog Advisory": "Freezing Fog",

  // Flooding
  "Flood Watch": "Flooding",
  "Flood Warning": "Flooding",
  "Flood Advisory": "Flooding",
  "Flash Flood Watch": "Flash Flooding",
  "Flash Flood Warning": "Flash Flooding",
  "Areal Flood Advisory": "Flooding",
  "Areal Flood Watch": "Flooding",
  "Areal Flood Warning": "Flooding",
  "Hydrologic Advisory": "Flooding",
  "Lakeshore Flood Warning": "Lakeshore Flooding",
  "Lakeshore Flood Watch": "Lakeshore Flooding",
  "Lakeshore Flood Advisory": "Lakeshore Flooding",
  "Coastal Flood Warning": "Coastal Flooding",
  "Coastal Flood Watch": "Coastal Flooding",
  "Coastal Flood Advisory": "Coastal Flooding",

  // Severe / Tornado
  "Tornado Warning": "Tornado",
  "Tornado Watch": "Tornado",
  "Severe Thunderstorm Warning": "Severe Thunderstorm",
  "Severe Thunderstorm Watch": "Severe Thunderstorm",
  "Thunderstorm Wind": "Thunderstorm Winds",

  // Heat
  "Heat Advisory": "Excessive Heat",
  "Excessive Heat Warning": "Extreme Heat",
  "Excessive Heat Watch": "Extreme Heat",

  // Cold / Freeze / Frost
  "Frost Advisory": "Frost",
  "Freeze Warning": "Hard Freeze",
  "Freeze Watch": "Freeze",
  "Hard Freeze Warning": "Hard Freeze",
  "Hard Freeze Watch": "Hard Freeze",
  "Cold Weather Advisory": "Cold Weather",
  "Extreme Cold Warning": "Extreme Cold",
  "Extreme Cold Watch": "Extreme Cold",

  // Dust
  "Dust Storm Warning": "Dust Storm",
  "Dust Advisory": "Blowing Dust",
  "Blowing Dust Advisory": "Blowing Dust",
  "Blowing Dust Warning": "Blowing Dust",

  // Avalanche
  "Avalanche Warning": "Avalanche",
  "Avalanche Watch": "Avalanche",
  "Avalanche Advisory": "Avalanche",

  // Air quality
  "Air Quality Alert": "Poor Air Quality",
  "Air Stagnation Advisory": "Poor Air Quality",

  // Tropical
  "Hurricane Warning": "Hurricane",
  "Hurricane Watch": "Hurricane",
  "Tropical Storm Warning": "Tropical Storm",
  "Tropical Storm Watch": "Tropical Storm",
  "Typhoon Warning": "Typhoon",
  "Typhoon Watch": "Typhoon",

  // Marine (may appear on inland/coastal routes)
  "Gale Warning": "Gale",
  "Storm Warning": "Storm",
  "Rip Current Statement": "Rip Currents",
  "Beach Hazards Statement": "Beach Hazards",
  "Small Craft Advisory": "Rough Waters",

  // Geophysical
  "Tsunami Warning": "Tsunami",
  "Tsunami Watch": "Tsunami",
  "Earthquake Warning": "Earthquake",
  "Volcano Warning": "Volcano",

  // Generic / catch-alls
  "Special Weather Statement": "Weather Alert",
  "Hazardous Weather Outlook": "Weather Outlook",
};

/**
 * Returns a concise plain-English condition label for an NWS event type.
 * Falls back to stripping the bureaucratic suffix (Warning / Watch / Advisory /
 * Statement / Information) when the event isn't in the lookup table.
 */
export function nwsEventLabel(event: string): string {
  if (event in NWS_CONDITION_LABELS) return NWS_CONDITION_LABELS[event]!;

  // Fallback: strip trailing NWS designation words to get the core condition
  const stripped = event
    .replace(/\s+(Warning|Watch|Advisory|Statement|Information|Outlook|Message)$/i, "")
    .trim();

  return stripped.length > 2 ? stripped : event;
}
