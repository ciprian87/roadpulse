"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ReportCard } from "@/components/community/ReportCard";
import { ReportForm } from "@/components/community/ReportForm";
import { REPORT_TYPE_SHORT } from "@/lib/types/community";
import type { CommunityReportApiItem, CommunityReportType } from "@/lib/types/community";
import { useMapStore } from "@/stores/map-store";

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

const TYPE_FILTERS: Array<{ value: CommunityReportType | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "ROAD_HAZARD", label: REPORT_TYPE_SHORT["ROAD_HAZARD"] },
  { value: "CLOSURE_UPDATE", label: REPORT_TYPE_SHORT["CLOSURE_UPDATE"] },
  { value: "WEATHER_CONDITION", label: REPORT_TYPE_SHORT["WEATHER_CONDITION"] },
  { value: "WAIT_TIME", label: REPORT_TYPE_SHORT["WAIT_TIME"] },
  { value: "PARKING_FULL", label: REPORT_TYPE_SHORT["PARKING_FULL"] },
  { value: "OTHER", label: REPORT_TYPE_SHORT["OTHER"] },
];

export default function CommunityPage() {
  const darkMode = useMapStore((s) => s.darkMode);
  const [reports, setReports] = useState<CommunityReportApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CommunityReportType | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [fetchTick, setFetchTick] = useState(0);

  const bg = darkMode ? "#111118" : "#ffffff";
  const border = darkMode ? "#2a2a38" : "#dcdce8";
  const textMuted = darkMode ? "#6a6a8a" : "#7070a0";

  useEffect(() => {
    fetch("/api/reports?limit=100")
      .then((r) => r.json())
      .then((data: { reports: CommunityReportApiItem[] }) => {
        setReports(data.reports ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [fetchTick]);

  function handleVote(
    reportId: string,
    newUpvotes: number,
    newDownvotes: number,
    userVote: "up" | "down" | null
  ) {
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? { ...r, upvotes: newUpvotes, downvotes: newDownvotes, user_vote: userVote }
          : r
      )
    );
  }

  function handleSubmitted() {
    setFetchTick((t) => t + 1);
  }

  const filtered =
    typeFilter === "ALL"
      ? reports
      : reports.filter((r) => r.type === typeFilter);

  return (
    <div className="w-full h-full flex flex-col md:flex-row">
      {/* ── Desktop map panel ───────────────────────────────── */}
      <div className="hidden md:block flex-1 relative h-full">
        <MapView />
      </div>

      {/* ── List panel ──────────────────────────────────────── */}
      <div
        className="flex flex-col md:w-[400px] md:flex-none h-full overflow-hidden"
        style={{ backgroundColor: bg, borderLeft: `1px solid ${border}` }}
      >
        {/* Panel header */}
        <div
          className="flex-none px-4 pt-4 pb-3"
          style={{ borderBottom: `1px solid ${border}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold" style={{ color: "var(--rp-text)" }}>
              Driver Reports
            </h1>
            <span className="text-xs" style={{ color: textMuted }}>
              {filtered.length} active
            </span>
          </div>

          {/* Type filter chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {TYPE_FILTERS.map(({ value, label }) => {
              const active = typeFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => setTypeFilter(value)}
                  className="flex-none rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: active
                      ? "var(--rp-info)"
                      : "var(--rp-surface-2)",
                    color: active ? "#ffffff" : textMuted,
                    border: `1px solid ${active ? "var(--rp-info)" : border}`,
                    minHeight: "28px",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>


        {/* Report list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm" style={{ color: textMuted }}>Loading reports…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
              <span className="text-3xl" aria-hidden="true">📡</span>
              <p className="text-sm font-medium" style={{ color: "var(--rp-text)" }}>
                No reports in this area
              </p>
              <p className="text-xs" style={{ color: textMuted }}>
                Be the first to report a road condition for other drivers.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {filtered.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onVote={handleVote}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── FAB ─────────────────────────────────────────────── */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-4 md:bottom-6 flex items-center gap-2 rounded-full shadow-lg transition-transform active:scale-95"
        style={{
          zIndex: 1000,
          height: "52px",
          paddingLeft: "20px",
          paddingRight: "20px",
          backgroundColor: "var(--rp-info)",
          color: "#ffffff",
        }}
        aria-label="Add a report"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="text-sm font-semibold">Report</span>
      </button>

      {/* ── Report Form Modal ────────────────────────────────── */}
      {showForm && (
        <ReportForm
          onClose={() => setShowForm(false)}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}
