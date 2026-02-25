"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable, type Column } from "@/components/admin/DataTable";
import type { StateQualityMetric, AnomalyRow, FeedCoverageRow } from "@/lib/admin/data-quality-repository";

function QualityBar({ score }: { score: number }) {
  const color = score >= 80 ? "#36cfc9" : score >= 50 ? "#ffd000" : "#ff4d4f";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "var(--rp-border)" }}>
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

const METRIC_COLS: Column<Record<string, unknown>>[] = [
  { key: "state", label: "State", sortable: true },
  { key: "total_events", label: "Events", sortable: true, render: (r) => <span className="font-mono">{Number(r.total_events).toLocaleString()}</span> },
  { key: "missing_geometry_pct", label: "No Geometry", sortable: true, render: (r) => <span style={{ color: Number(r.missing_geometry_pct) > 10 ? "#ff4d4f" : "var(--rp-text-muted)" }}>{String(r.missing_geometry_pct)}%</span> },
  { key: "missing_description_pct", label: "No Description", sortable: true, render: (r) => <span style={{ color: Number(r.missing_description_pct) > 30 ? "#ffd000" : "var(--rp-text-muted)" }}>{String(r.missing_description_pct)}%</span> },
  { key: "avg_age_hours", label: "Avg Age", sortable: true, render: (r) => <span className="font-mono text-xs" style={{ color: "var(--rp-text-muted)" }}>{String(r.avg_age_hours)}h</span> },
  { key: "quality_score", label: "Score", sortable: true, render: (r) => <QualityBar score={Number(r.quality_score)} /> },
];

export default function DataQualityPage() {
  const [metrics, setMetrics] = useState<StateQualityMetric[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [coverage, setCoverage] = useState<FeedCoverageRow[]>([]);
  const [sortKey, setSortKey] = useState("quality_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/admin/data-quality/summary").then((r) => r.json()),
      fetch("/api/admin/data-quality/anomalies").then((r) => r.json()),
      fetch("/api/admin/data-quality/coverage").then((r) => r.json()),
    ]).then(([sumRes, anomRes, covRes]) => {
      if (sumRes.status === "fulfilled") setMetrics((sumRes.value as { metrics: StateQualityMetric[] }).metrics ?? []);
      if (anomRes.status === "fulfilled") setAnomalies((anomRes.value as { anomalies: AnomalyRow[] }).anomalies ?? []);
      if (covRes.status === "fulfilled") setCoverage((covRes.value as { coverage: FeedCoverageRow[] }).coverage ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const sorted = [...metrics].sort((a, b) => {
    const av = Number(a[sortKey as keyof StateQualityMetric]);
    const bv = Number(b[sortKey as keyof StateQualityMetric]);
    return sortDir === "asc" ? av - bv : bv - av;
  });

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const avgScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.quality_score, 0) / metrics.length)
    : 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <AdminPageHeader title="Data Quality" description="Per-state event completeness and freshness metrics" />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="States with Feeds" value={coverage.length} />
        <StatCard label="Avg Quality Score" value={`${avgScore}/100`} status={avgScore >= 80 ? "healthy" : avgScore >= 50 ? "warning" : "critical"} />
        <StatCard label="Anomalies Detected" value={anomalies.length} status={anomalies.length === 0 ? "healthy" : "warning"} />
      </div>

      {anomalies.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--rp-text)" }}>Anomalies</h2>
          {anomalies.map((a, i) => (
            <div
              key={i}
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                backgroundColor: a.severity === "critical" ? "#ff4d4f15" : "#ffd00015",
                border: `1px solid ${a.severity === "critical" ? "#ff4d4f40" : "#ffd00040"}`,
                color: a.severity === "critical" ? "#ff4d4f" : "#ffd000",
              }}
            >
              <span className="font-semibold">{a.label}</span>
              <span className="ml-2 opacity-70">{a.detail}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--rp-text)" }}>
          State Quality Metrics
        </h2>
        {loading ? (
          <p style={{ color: "var(--rp-text-muted)" }}>Loading…</p>
        ) : (
          <DataTable
            columns={METRIC_COLS}
            data={sorted as unknown as Record<string, unknown>[]}
            onSort={handleSort}
            sortKey={sortKey}
            sortDir={sortDir}
            emptyMessage="No state data available."
          />
        )}
      </div>
    </div>
  );
}
