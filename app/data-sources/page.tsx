import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Sources | RoadPulse",
  description: "All data sources powering RoadPulse real-time road and weather hazard information.",
};

const SOURCES = [
  {
    name: "NWS Weather Alerts",
    description:
      "Active weather alerts (warnings, watches, advisories) issued by the National Weather Service for all US zones.",
    frequency: "Every 2 minutes",
    type: "Weather",
    url: "https://www.weather.gov",
  },
  {
    name: "State 511 WZDx Feeds",
    description:
      "Road closures, construction, incidents, chain laws, and restrictions from 35 US state DOT 511 systems via the Work Zone Data Exchange (WZDx) standard.",
    frequency: "Every 10–60 minutes (per state)",
    type: "Road Events",
    states:
      "AL, AZ, CA, CO, CT, FL, GA, IA, ID, IL, IN, KS, KY, LA, MD, ME, MI, MN, MO, MT, NC, ND, NE, NH, NM, NV, NY, OH, OK, OR, PA, SD, TN, TX, UT, VA, VT, WA, WI, WV, WY",
    url: null,
  },
  {
    name: "MAASTO TPIMS Truck Parking",
    description:
      "Real-time truck parking availability from the Mid-America Association of State Transportation Officials (MAASTO) Truck Parking Information Management System.",
    frequency: "Every 5 minutes (availability) / 24 hours (facility list)",
    type: "Parking",
    states: "IN, IA, KS, KY, MI, MN, OH, WI",
    url: "https://www.maasto.net",
  },
  {
    name: "OpenRouteService",
    description:
      "Truck-optimized routing (driving-hgv profile) for origin-to-destination route geometry and travel time estimates.",
    frequency: "On-demand (5-minute cache)",
    type: "Routing",
    url: "https://openrouteservice.org",
  },
  {
    name: "OpenStreetMap",
    description:
      "Base map tiles provided by OpenStreetMap contributors via CARTO (Dark Matter and Voyager tile sets).",
    frequency: "Static map tiles (7-day cache)",
    type: "Map Tiles",
    url: "https://www.openstreetmap.org",
  },
  {
    name: "Community Driver Reports",
    description:
      "Crowd-sourced hazard reports submitted by RoadPulse users. Reports expire after 6 hours and are community-voted for accuracy.",
    frequency: "Real-time",
    type: "Community",
    url: null,
  },
];

const TYPE_COLORS: Record<string, string> = {
  Weather: "#4096ff",
  "Road Events": "#ff8c00",
  Parking: "#36cfc9",
  Routing: "#ffd000",
  "Map Tiles": "#6a6a8a",
  Community: "#a855f7",
};

export default function DataSourcesPage() {
  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--rp-bg)" }}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--rp-text)" }}>
            Data Sources
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--rp-text-muted)" }}>
            All real-time data powering RoadPulse road hazard and weather information.
          </p>
        </div>

        <div className="space-y-3">
          {SOURCES.map((source) => {
            const typeColor = TYPE_COLORS[source.type] ?? "#6a6a8a";
            return (
              <div
                key={source.name}
                className="rounded-xl p-4 space-y-2"
                style={{
                  backgroundColor: "var(--rp-surface)",
                  border: "1px solid var(--rp-border)",
                }}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full flex-none"
                    style={{
                      backgroundColor: `${typeColor}22`,
                      color: typeColor,
                      border: `1px solid ${typeColor}44`,
                    }}
                  >
                    {source.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold hover:underline"
                        style={{ color: "var(--rp-text)" }}
                      >
                        {source.name} ↗
                      </a>
                    ) : (
                      <p className="text-sm font-semibold" style={{ color: "var(--rp-text)" }}>
                        {source.name}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-sm" style={{ color: "var(--rp-text-muted)" }}>
                  {source.description}
                </p>

                {"states" in source && source.states && (
                  <p className="text-xs" style={{ color: "var(--rp-text-muted)" }}>
                    <span className="font-medium">States:</span> {source.states}
                  </p>
                )}

                <p className="text-xs" style={{ color: "var(--rp-text-muted)" }}>
                  <span className="font-medium">Update frequency:</span> {source.frequency}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
