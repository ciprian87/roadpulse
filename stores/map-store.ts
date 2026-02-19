"use client";

import { create } from "zustand";
import type { WeatherAlertApiItem } from "@/lib/types/weather";
import { DEFAULT_VISIBLE_CATEGORIES } from "@/lib/utils/alert-categories";

interface MapState {
  center: [number, number];
  zoom: number;
  selectedAlert: WeatherAlertApiItem | null;
  darkMode: boolean;
  // Record<categoryKey, visible> — plain object so Zustand detects changes
  visibleCategories: Record<string, boolean>;

  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  selectAlert: (alert: WeatherAlertApiItem) => void;
  clearSelection: () => void;
  toggleDarkMode: () => void;
  toggleCategory: (key: string) => void;
  resetCategories: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [39.5, -98.35], // geographic center of the contiguous US
  zoom: 4,
  selectedAlert: null,
  darkMode: true,
  visibleCategories: { ...DEFAULT_VISIBLE_CATEGORIES },

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  selectAlert: (alert) => set({ selectedAlert: alert }),
  clearSelection: () => set({ selectedAlert: null }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  toggleCategory: (key) =>
    set((s) => ({
      visibleCategories: {
        ...s.visibleCategories,
        [key]: !s.visibleCategories[key],
      },
    })),
  resetCategories: () =>
    set({ visibleCategories: { ...DEFAULT_VISIBLE_CATEGORIES } }),
}));
