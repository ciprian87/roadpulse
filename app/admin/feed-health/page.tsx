"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusDot } from "@/components/admin/StatusDot";
import { TimeAgo } from "@/components/admin/TimeAgo";
import type { FeedStatus } from "@/lib/db/schema";

type FeedStatusValue = "healthy" | "degraded" | "down" | "unknown";

function asStatusValue(s: string): FeedStatusValue {
  if (s === "healthy" || s === "degraded" || s === "down") return s;
  return "unknown";
}

export default function FeedHealthPage() {
  const [feeds, setFeeds] = useState<FeedStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingestingFeed, setIngestingFeed] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchFeeds = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feeds");
      if (!res.ok) return;
      const data = (await res.json()) as { feeds: FeedStatus[] };
      setFeeds(data.feeds);
      setLastRefreshed(new Date());
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFeeds();
    const interval = setInterval(() => void fetchFeeds(), 30_000);
    return () => clearInterval(interval);
  }, [fetchFeeds]);

  async function triggerIngest(feedName: string) {
    setIngestingFeed(feedName);
    try {
      const res = await fetch(`/api/admin/feeds/${encodeURIComponent(feedName)}/refresh`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchFeeds();
    } catch {
      // Non-fatal — feed table will reflect true state after fetchFeeds
      await fetchFeeds();
    } finally {
      setIngestingFeed(null);
    }
  }

  const downFeeds = feeds.filter((f) => f.status === "down");
  const staleFeeds = feeds.filter((f) => {
    if (!f.last_success_at) return false;
    const staleMins = (Date.now() - new Date(f.last_success_at).getTime()) / 60_000;
    return staleMins > 30 && f.status !== "down";
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <AdminPageHeader
        title="Feed Health"
        description={lastRefreshed ? `Last refreshed ${new Date(lastRefreshed).toLocaleTimeString()} · auto-refreshes every 30s` : undefined}
        actions={
          <button
            onClick={() => void triggerIngest("all")}
            disabled={ingestingFeed !== null}
            className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
            style={{ backgroundColor: "#4096ff", color: "#ffffff" }}
          >
            {ingestingFeed === "all" ? "Ingesting…" : "Refresh All"}
          </button>
        }
      />

      {/* Alert banners */}
      {downFeeds.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: "#ff4d4f15", border: "1px solid #ff4d4f40", color: "#ff4d4f" }}
        >
          ⚠ {downFeeds.length} feed{downFeeds.length > 1 ? "s" : ""} down:{" "}
          {downFeeds.map((f) => f.feed_name).join(", ")}
        </div>
      )}
      {staleFeeds.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: "#ffd00015", border: "1px solid #ffd00040", color: "#ffd000" }}
        >
          ⚠ {staleFeeds.length} feed{staleFeeds.length > 1 ? "s" : ""} stale (&gt;30 min):{" "}
          {staleFeeds.map((f) => f.feed_name).join(", ")}
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--rp-text-muted)" }}>Loading…</p>
      ) : feeds.length === 0 ? (
        <p style={{ color: "var(--rp-text-muted)" }}>No feeds registered yet.</p>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--rp-border)" }}
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "var(--rp-surface)", borderBottom: "1px solid var(--rp-border)" }}>
                {["Feed", "State", "Status", "Last Success", "Last Error", "Records", "Avg ms", "Enabled", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-xs font-semibold"
                    style={{ color: "var(--rp-text-muted)", whiteSpace: "nowrap" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feeds.map((feed) => {
                const isUnhealthy = feed.status === "down";
                return (
                  <tr
                    key={feed.id}
                    style={{
                      borderBottom: "1px solid var(--rp-border)",
                      backgroundColor: isUnhealthy ? "#ff4d4f08" : undefined,
                    }}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "var(--rp-text)" }}>
                      {feed.feed_name}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--rp-text-muted)" }}>
                      {feed.state ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusDot status={asStatusValue(feed.status)} />
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--rp-text-muted)" }}>
                      <TimeAgo date={feed.last_success_at ? String(feed.last_success_at) : null} />
                    </td>
                    <td
                      className="px-3 py-2.5 text-xs max-w-[200px] truncate"
                      style={{ color: isUnhealthy ? "#ff4d4f" : "var(--rp-text-muted)" }}
                      title={feed.last_error_message ?? undefined}
                    >
                      {feed.last_error_message ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-mono" style={{ color: "var(--rp-text-muted)" }}>
                      {feed.record_count ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-mono" style={{ color: "var(--rp-text-muted)" }}>
                      {feed.avg_fetch_ms ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: feed.is_enabled !== false ? "#36cfc9" : "#6a6a8a" }}>
                      {feed.is_enabled !== false ? "on" : "off"}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => void triggerIngest(feed.feed_name)}
                        disabled={ingestingFeed !== null}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg disabled:opacity-40"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--rp-info) 15%, transparent)",
                          color: "var(--rp-info)",
                          border: "1px solid color-mix(in srgb, var(--rp-info) 30%, transparent)",
                        }}
                      >
                        {ingestingFeed === feed.feed_name ? "…" : "Refresh"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
