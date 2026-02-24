"use client";

import { create } from "zustand";
import type { WeatherAlertApiItem } from "@/lib/types/weather";
import type { RoadEventApiItem } from "@/lib/types/road-event";
import type { CommunityReportApiItem } from "@/lib/types/community";
import {
  DEFAULT_VISIBLE_CATEGORIES,
  DEFAULT_VISIBLE_ROAD_TYPES,
} from "@/lib/utils/alert-categories";

export type SelectedHazard =
  | { kind: "weather"; alert: WeatherAlertApiItem }
  | { kind: "road"; event: RoadEventApiItem }
  | { kind: "community"; report: CommunityReportApiItem };

interface MapState {
  center: [number, number];
  zoom: number;
  selectedHazard: SelectedHazard | null;
  // Backward-compatible alias kept for AlertDetailPanel.tsx (untouched file).
  selectedAlert: WeatherAlertApiItem | null;
  darkMode: boolean;
  // NWS weather alert category visibility
  visibleCategories: Record<string, boolean>;
  // 511 / WZDx road event type visibility
  visibleRoadTypes: Record<string, boolean>;

  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  selectAlert: (alert: WeatherAlertApiItem) => void;
  selectEvent: (event: RoadEventApiItem) => void;
  selectCommunityReport: (report: CommunityReportApiItem) => void;
  clearSelection: () => void;
  toggleDarkMode: () => void;
  toggleCategory: (key: string) => void;
  resetCategories: () => void;
  toggleRoadType: (key: string) => void;
  resetRoadTypes: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [39.5, -98.35],
  zoom: 4,
  selectedHazard: null,
  selectedAlert: null,
  darkMode: true,
  visibleCategories: { ...DEFAULT_VISIBLE_CATEGORIES },
  visibleRoadTypes:  { ...DEFAULT_VISIBLE_ROAD_TYPES },

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),

  selectAlert: (alert) =>
    set({ selectedHazard: { kind: "weather", alert }, selectedAlert: alert }),

  selectEvent: (event) =>
    set({ selectedHazard: { kind: "road", event }, selectedAlert: null }),

  selectCommunityReport: (report) =>
    set({ selectedHazard: { kind: "community", report }, selectedAlert: null }),

  clearSelection: () => set({ selectedHazard: null, selectedAlert: null }),

  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

  toggleCategory: (key) =>
    set((s) => ({
      visibleCategories: { ...s.visibleCategories, [key]: !s.visibleCategories[key] },
    })),

  resetCategories: () =>
    set({ visibleCategories: { ...DEFAULT_VISIBLE_CATEGORIES } }),

  toggleRoadType: (key) =>
    set((s) => ({
      visibleRoadTypes: { ...s.visibleRoadTypes, [key]: !s.visibleRoadTypes[key] },
    })),

  resetRoadTypes: () =>
    set({ visibleRoadTypes: { ...DEFAULT_VISIBLE_ROAD_TYPES } }),
}));
