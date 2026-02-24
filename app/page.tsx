"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { SavedRoute } from "@/lib/db/schema";

// Leaflet requires the browser DOM — disable SSR for the entire map view
const MapView = dynamic(() => import("@/components/map/MapContainer"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ backgroundColor: "var(--rp-bg)" }}
    >
      <p style={{ color: "var(--rp-text-muted)" }}>Loading map…</p>
    </div>
  ),
});

export default function MapPage() {
  return (
    // h-full works because AppShell gives the main area flex-1 min-h-0
    <div className="w-full h-full relative">
      <MapView />
      <QuickRoutes />
    </div>
  );
}

/* ─── Quick Routes overlay ────────────────────────────────────────────────── */

function QuickRoutes() {
  const { data: session } = useSession();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    fetch("/api/user/routes")
      .then((r) => r.json())
      .then((data: { routes: SavedRoute[] }) => {
        // Show favorites first, then most recent — cap at 5
        setRoutes(data.routes.slice(0, 5));
      })
      .catch(() => {
        // Non-fatal: no quick routes if fetch fails
      });
  }, [session]);

  if (!session || routes.length === 0) return null;

  function handleRouteClick(route: SavedRoute) {
    const params = new URLSearchParams({
      origin: route.origin_address,
      olat: route.origin_lat,
      olng: route.origin_lng,
      dest: route.destination_address,
      dlat: route.destination_lat,
      dlng: route.destination_lng,
    });
    router.push(`/route?${params.toString()}`);
  }

  return (
    // Float over the map at bottom-left, above the Leaflet attribution
    <div
      className="absolute bottom-6 left-3 z-[1000] flex flex-col gap-1 max-w-[240px]"
      style={{ pointerEvents: "auto" }}
    >
      <p
        className="text-xs font-semibold px-1 mb-0.5"
        style={{ color: "var(--rp-text-muted)", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
      >
        Your Routes
      </p>
      {routes.map((route) => (
        <button
          key={route.id}
          onClick={() => handleRouteClick(route)}
          className="flex items-center gap-1.5 rounded-lg px-3 text-left text-xs font-medium truncate transition-colors"
          style={{
            height: "36px",
            backgroundColor: "color-mix(in srgb, var(--rp-surface) 90%, transparent)",
            border: "1px solid var(--rp-border)",
            color: "var(--rp-text)",
            backdropFilter: "blur(8px)",
          }}
          title={route.name}
        >
          {route.is_favorite && (
            <span style={{ color: "var(--rp-warning)" }}>★</span>
          )}
          <span className="truncate">{route.name}</span>
        </button>
      ))}
      <Link
        href="/account"
        className="text-xs text-center px-1 mt-0.5"
        style={{
          color: "var(--rp-info)",
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
        }}
      >
        Manage routes →
      </Link>
    </div>
  );
}
