"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface AppSettingRow {
  key: string;
  value: unknown;
  updated_at: string | null;
  updated_by: string | null;
}

interface FeedStatusRow {
  id: string;
  feed_name: string;
  state: string | null;
  is_enabled: boolean | null;
  refresh_interval_minutes: number | null;
  status: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettingRow[]>([]);
  const [feeds, setFeeds] = useState<FeedStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const fetchAll = useCallback(async () => {
    const [settingsRes, feedsRes] = await Promise.allSettled([
      fetch("/api/admin/settings").then((r) => r.json()),
      fetch("/api/admin/feeds").then((r) => r.json()),
    ]);
    if (settingsRes.status === "fulfilled") setSettings((settingsRes.value as { settings: AppSettingRow[] }).settings ?? []);
    if (feedsRes.status === "fulfilled") setFeeds((feedsRes.value as { feeds: FeedStatusRow[] }).feeds ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
  }, [fetchAll]);

  async function saveSetting(key: string, value: unknown) {
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    setSaveMsg("Saved");
    setTimeout(() => setSaveMsg(""), 2000);
    setSaving(false);
    void fetchAll();
  }

  async function runAction(action: string) {
    setSaving(true);
    const res = await fetch("/api/admin/settings/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await res.json()) as { description?: string };
    setSaveMsg(data.description ?? "Done");
    setTimeout(() => setSaveMsg(""), 3000);
    setSaving(false);
  }

  function getSettingValue(key: string): unknown {
    return settings.find((s) => s.key === key)?.value ?? null;
  }

  if (loading) return <div style={{ color: "var(--rp-text-muted)" }}>Loading…</div>;

  return (
    <div className="space-y-8 max-w-3xl">
      <AdminPageHeader
        title="Settings"
        description="Platform configuration and maintenance actions"
        actions={saveMsg ? <span className="text-xs font-medium" style={{ color: "#36cfc9" }}>{saveMsg}</span> : undefined}
      />

      {/* App settings */}
      <section>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--rp-text)" }}>Platform Settings</h2>
        <div
          className="rounded-xl divide-y"
          style={{ border: "1px solid var(--rp-border)", borderColor: "var(--rp-border)" }}
        >
          {[
            { key: "nws_cache_ttl_seconds", label: "NWS Cache TTL (seconds)", type: "number" },
            { key: "route_cache_ttl_seconds", label: "Route Cache TTL (seconds)", type: "number" },
            { key: "corridor_buffer_miles", label: "Default Corridor Buffer (miles)", type: "number" },
            { key: "community_report_ttl_hours", label: "Community Report TTL (hours)", type: "number" },
            { key: "community_report_vote_threshold", label: "Auto-remove vote threshold", type: "number" },
            { key: "community_report_rate_limit_per_hour", label: "Reports per user per hour", type: "number" },
            { key: "max_api_limit", label: "Max API list limit", type: "number" },
            { key: "feed_default_interval_minutes", label: "Default feed interval (minutes)", type: "number" },
          ].map((cfg) => {
            const current = getSettingValue(cfg.key);
            return (
              <div key={cfg.key} className="flex items-center justify-between px-4 py-3 gap-4">
                <label className="text-sm" style={{ color: "var(--rp-text)" }}>{cfg.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={String(current ?? "")}
                    onBlur={(e) => void saveSetting(cfg.key, parseFloat(e.target.value))}
                    disabled={saving}
                    className="w-24 px-2 py-1 rounded text-sm font-mono text-right"
                    style={{
                      backgroundColor: "var(--rp-bg)",
                      border: "1px solid var(--rp-border)",
                      color: "var(--rp-text)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feed settings */}
      <section>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--rp-text)" }}>Feed Configuration</h2>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--rp-border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "var(--rp-surface)", borderBottom: "1px solid var(--rp-border)" }}>
                {["Feed", "State", "Status", "Enabled", "Interval (min)"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold" style={{ color: "var(--rp-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feeds.map((feed) => (
                <tr key={feed.id} style={{ borderBottom: "1px solid var(--rp-border)" }}>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "var(--rp-text)" }}>{feed.feed_name}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--rp-text-muted)" }}>{feed.state ?? "—"}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--rp-text-muted)" }}>{feed.status}</td>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      defaultChecked={feed.is_enabled !== false}
                      onChange={async (e) => {
                        await fetch(`/api/admin/feeds/${encodeURIComponent(feed.feed_name)}/config`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ is_enabled: e.target.checked }),
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      defaultValue={feed.refresh_interval_minutes ?? 5}
                      min={1}
                      max={60}
                      className="w-16 px-2 py-1 rounded text-xs font-mono"
                      style={{ backgroundColor: "var(--rp-bg)", border: "1px solid var(--rp-border)", color: "var(--rp-text)" }}
                      onBlur={async (e) => {
                        const mins = parseInt(e.target.value, 10);
                        if (!isNaN(mins) && mins >= 1) {
                          await fetch(`/api/admin/feeds/${encodeURIComponent(feed.feed_name)}/config`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ refresh_interval_minutes: mins }),
                          });
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Maintenance actions */}
      <section>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--rp-text)" }}>Maintenance</h2>
        <div className="space-y-3">
          {[
            { action: "purge_expired_reports", label: "Purge Expired Community Reports", description: "Delete inactive reports that have been expired for more than 7 days." },
            { action: "purge_old_ingestion_logs", label: "Purge Old Ingestion Logs", description: "Delete ingestion log entries older than 30 days." },
            { action: "purge_old_usage_events", label: "Purge Old Usage Events", description: "Delete usage events older than 90 days." },
          ].map((item) => (
            <div
              key={item.action}
              className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
              style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--rp-text)" }}>{item.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--rp-text-muted)" }}>{item.description}</p>
              </div>
              <button
                onClick={() => void runAction(item.action)}
                disabled={saving}
                className="text-xs font-medium px-3 py-1.5 rounded-lg flex-none disabled:opacity-50"
                style={{ backgroundColor: "#ff4d4f15", color: "#ff4d4f", border: "1px solid #ff4d4f40" }}
              >
                Run
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
