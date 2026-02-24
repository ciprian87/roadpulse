"use client";

import { create } from "zustand";
import type { RouteCheckResponse, RouteHazard } from "@/lib/types/route";

export type RouteCheckStatus =
  | "idle"
  | "geocoding"
  | "routing"
  | "checking"
  | "success"
  | "error";

interface RouteStoreState {
  originText: string;
  destinationText: string;
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  status: RouteCheckStatus;
  errorMessage: string | null;
  result: RouteCheckResponse | null;
  selectedHazard: RouteHazard | null;
  /** [lat, lng] consumed by RouteLayer to call map.flyTo — reset to null after use */
  flyToTarget: [number, number] | null;

  setOriginText: (t: string) => void;
  setDestinationText: (t: string) => void;
  setOriginCoords: (lat: number, lng: number) => void;
  setDestinationCoords: (lat: number, lng: number) => void;
  setSelectedHazard: (h: RouteHazard | null) => void;
  setFlyToTarget: (target: [number, number] | null) => void;
  swapPoints: () => void;
  clearRoute: () => void;
  checkRoute: () => Promise<void>;
}

export const useRouteStore = create<RouteStoreState>((set, get) => ({
  originText: "",
  destinationText: "",
  originLat: null,
  originLng: null,
  destinationLat: null,
  destinationLng: null,
  status: "idle",
  errorMessage: null,
  result: null,
  selectedHazard: null,
  flyToTarget: null,

  setOriginText: (t) => set({ originText: t }),
  setDestinationText: (t) => set({ destinationText: t }),
  setOriginCoords: (lat, lng) => set({ originLat: lat, originLng: lng }),
  setDestinationCoords: (lat, lng) => set({ destinationLat: lat, destinationLng: lng }),
  setSelectedHazard: (selectedHazard) => set({ selectedHazard }),
  setFlyToTarget: (flyToTarget) => set({ flyToTarget }),

  swapPoints: () => {
    const { originText, destinationText, originLat, originLng, destinationLat, destinationLng } =
      get();
    set({
      originText: destinationText,
      destinationText: originText,
      originLat: destinationLat,
      originLng: destinationLng,
      destinationLat: originLat,
      destinationLng: originLng,
    });
  },

  clearRoute: () =>
    set({ result: null, selectedHazard: null, status: "idle", errorMessage: null }),

  checkRoute: async () => {
    const { originText, destinationText, originLat, originLng, destinationLat, destinationLng } =
      get();
    if (!originText || !destinationText) return;

    set({ status: "geocoding", errorMessage: null });

    try {
      const body = {
        originAddress: originText,
        destinationAddress: destinationText,
        ...(originLat !== null && originLng !== null ? { originLat, originLng } : {}),
        ...(destinationLat !== null && destinationLng !== null
          ? { destinationLat, destinationLng }
          : {}),
      };

      // Advance status cosmetically — the real work is server-side
      set({ status: "routing" });

      const res = await fetch("/api/route/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      set({ status: "checking" });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string; code?: string };
        const code = err.code ?? "INTERNAL_ERROR";
        let msg = err.error ?? "Route check failed";
        if (code === "ORS_RATE_LIMIT") msg = "Route service busy, retry in 60s";
        else if (code === "ROUTE_NOT_FOUND") msg = "No route found between those locations";
        else if (code === "GEOCODE_NO_RESULTS")
          msg = "Address not found — try a more specific location";
        set({ status: "error", errorMessage: msg });
        return;
      }

      const data = (await res.json()) as RouteCheckResponse;
      set({ status: "success", result: data, errorMessage: null });
    } catch {
      set({ status: "error", errorMessage: "Connection error — please try again." });
    }
  },
}));
