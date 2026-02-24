"use client";

import { useState } from "react";
import { HazardCard } from "./HazardCard";
import type { RouteHazard } from "@/lib/types/route";

const DARK = {
  heading: "#f0f0f5",
  label: "#6a6a8a",
  section: "#1a1a24",
  border: "#2a2a38",
  tabBg: "#111118",
  tabActiveBg: "#4096ff",
  tabActiveText: "#ffffff",
  tabInactiveText: "#6a6a8a",
};
const LIGHT = {
  heading: "#0f0f1a",
  label: "#7070a0",
  section: "#f4f4f8",
  border: "#dcdce8",
  tabBg: "#f4f4f8",
  tabActiveBg: "#4096ff",
  tabActiveText: "#ffffff",
  tabInactiveText: "#7070a0",
};

type HazardFilter = "weather" | "road" | "community" | "both";

interface HazardListProps {
  hazards: RouteHazard[];
  selectedHazardId: string | null;
  onSelectHazard: (hazard: RouteHazard) => void;
  darkMode: boolean;
}

function ClearIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#36cfc9"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function HazardList({
  hazards,
  selectedHazardId,
  onSelectHazard,
  darkMode,
}: HazardListProps) {
  const t = darkMode ? DARK : LIGHT;
  const [filter, setFilter] = useState<HazardFilter>("weather");

  const weatherCount = hazards.filter((h) => h.kind === "weather_alert").length;
  const roadCount = hazards.filter((h) => h.kind === "road_event").length;
  const communityCount = hazards.filter((h) => h.kind === "community_report").length;

  const filtered = hazards.filter((h) => {
    if (filter === "weather") return h.kind === "weather_alert";
    if (filter === "road") return h.kind === "road_event";
    if (filter === "community") return h.kind === "community_report";
    return true;
  });

  const tabs: Array<{ key: HazardFilter; label: string; count: number }> = [
    { key: "weather", label: "Weather", count: weatherCount },
    { key: "road", label: "511", count: roadCount },
    { key: "community", label: "Drivers", count: communityCount },
    { key: "both", label: "All", count: hazards.length },
  ];

  const emptyMessages: Record<HazardFilter, { main: string; sub: string }> = {
    weather: {
      main: "No weather alerts along this route",
      sub: roadCount > 0 ? `${roadCount} 511 event${roadCount > 1 ? "s" : ""} found — switch to 511 or All` : "The corridor is clear",
    },
    road: {
      main: "No 511 events along this route",
      sub: weatherCount > 0 ? `${weatherCount} weather alert${weatherCount > 1 ? "s" : ""} found — switch to Weather or All` : "The corridor is clear",
    },
    community: {
      main: "No driver reports along this route",
      sub: "No community reports have been filed in this corridor",
    },
    both: {
      main: "No hazards along this route",
      sub: "The route corridor is clear",
    },
  };

  return (
    <div className="flex flex-col">
      {/* Filter tabs */}
      <div className="px-3 pb-2">
        <div
          className="flex rounded-lg p-0.5 gap-0.5"
          style={{ backgroundColor: t.section, border: `1px solid ${t.border}` }}
          role="tablist"
          aria-label="Filter hazard type"
        >
          {tabs.map(({ key, label, count }) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: isActive ? t.tabActiveBg : "transparent",
                  color: isActive ? t.tabActiveText : t.tabInactiveText,
                  minHeight: "32px",
                }}
              >
                {label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: isActive ? "rgba(255,255,255,0.25)" : t.border,
                    color: isActive ? t.tabActiveText : t.tabInactiveText,
                    minWidth: "20px",
                    textAlign: "center",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
          <span
            className="flex items-center justify-center rounded-full"
            style={{
              width: "48px",
              height: "48px",
              backgroundColor: "#36cfc922",
              border: "1px solid #36cfc944",
            }}
          >
            <ClearIcon />
          </span>
          <p className="text-sm font-medium" style={{ color: t.heading }}>
            {emptyMessages[filter].main}
          </p>
          <p className="text-xs" style={{ color: t.label }}>
            {emptyMessages[filter].sub}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 px-3 pb-4">
          {filtered.map((hazard) => (
            <HazardCard
              key={hazard.id}
              hazard={hazard}
              isSelected={hazard.id === selectedHazardId}
              onClick={() => onSelectHazard(hazard)}
              darkMode={darkMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
