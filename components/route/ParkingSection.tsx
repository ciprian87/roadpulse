"use client";

import { useState } from "react";
import type { ParkingFacilityNearRoute } from "@/lib/types/parking";

const DARK = {
  heading: "#f0f0f5",
  label: "#6a6a8a",
  section: "#1a1a24",
  border: "#2a2a38",
  body: "#c0c0d0",
};
const LIGHT = {
  heading: "#0f0f1a",
  label: "#7070a0",
  section: "#f4f4f8",
  border: "#dcdce8",
  body: "#2e2e42",
};

function availabilityColor(available: number | null, total: number | null): string {
  if (available === null || total === null || total === 0) return "#4096ff";
  const ratio = available / total;
  if (ratio > 0.5) return "#36cfc9";
  if (ratio >= 0.25) return "#ffd000";
  return "#ff4d4f";
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return `${miles.toFixed(1)} mi`;
}

interface Props {
  parkingNearRoute: ParkingFacilityNearRoute[];
  darkMode: boolean;
}

export function ParkingSection({ parkingNearRoute, darkMode }: Props) {
  const t = darkMode ? DARK : LIGHT;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mx-3 mb-4">
      {/* Section header — collapsible */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between py-2 px-3 rounded-lg mb-2"
        style={{ backgroundColor: t.section, border: `1px solid ${t.border}` }}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center text-xs font-bold rounded"
            style={{ width: "20px", height: "20px", backgroundColor: "#4096ff", color: "#0c0f14" }}
          >
            P
          </span>
          <span className="text-sm font-semibold" style={{ color: t.heading }}>
            Nearby Parking (within 5 mi)
          </span>
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: "#4096ff22", color: "#4096ff", border: "1px solid #4096ff44" }}
          >
            {parkingNearRoute.length}
          </span>
        </div>
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ color: t.label, transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!collapsed && (
        <>
          {parkingNearRoute.length === 0 ? (
            <div
              className="rounded-xl p-4 text-center"
              style={{ backgroundColor: t.section, border: `1px solid ${t.border}` }}
            >
              <p className="text-sm" style={{ color: t.label }}>
                No TPIMS parking data along this route
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {parkingNearRoute.map((facility) => {
                const avColor = availabilityColor(facility.available_spaces, facility.total_spaces);
                return (
                  <div
                    key={facility.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl"
                    style={{ backgroundColor: t.section, border: `1px solid ${t.border}` }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: t.heading }}>
                        {facility.name}
                      </p>
                      <p className="text-xs" style={{ color: t.label }}>
                        {[facility.highway, facility.direction, facility.state]
                          .filter(Boolean)
                          .join(" · ")}
                        {" · "}{formatDistance(facility.distance_from_route)} from route
                      </p>
                    </div>
                    <div className="text-right flex-none">
                      <p className="text-base font-bold" style={{ color: avColor }}>
                        {facility.available_spaces ?? "—"}
                      </p>
                      <p className="text-xs" style={{ color: t.label }}>
                        of {facility.total_spaces ?? "?"} open
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs mt-2 px-1" style={{ color: t.label }}>
            Parking data available in IN, IA, KS, KY, MI, MN, OH, WI — more states coming soon
          </p>
        </>
      )}
    </div>
  );
}
