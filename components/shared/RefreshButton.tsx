"use client";

import { useState } from "react";

// Triggers a manual NWS ingest and reloads the page to reflect updated counts.
// Minimum 44×44px touch target per mobile-first guidelines.
export function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [lastStatus, setLastStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );

  async function handleRefresh() {
    setLoading(true);
    setLastStatus("idle");
    try {
      const res = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed: "nws-alerts" }),
      });
      if (res.ok) {
        setLastStatus("success");
        // Reload to pick up the updated alert count and feed status from the server
        window.location.reload();
      } else {
        setLastStatus("error");
      }
    } catch {
      setLastStatus("error");
    } finally {
      setLoading(false);
    }
  }

  const label = loading
    ? "Refreshing..."
    : lastStatus === "error"
      ? "Refresh failed — retry?"
      : "Refresh Now";

  const colorClasses =
    lastStatus === "error"
      ? "bg-red-950 text-red-300 ring-1 ring-red-700 hover:bg-red-900"
      : "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-700";

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className={`min-h-[44px] rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${colorClasses}`}
    >
      {label}
    </button>
  );
}
