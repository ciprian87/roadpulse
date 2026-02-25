interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  /** Color hint for the value: 'healthy' | 'warning' | 'critical' | 'info' */
  status?: "healthy" | "warning" | "critical" | "info";
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "#36cfc9",
  warning: "#ffd000",
  critical: "#ff4d4f",
  info: "#4096ff",
};

export function StatCard({ label, value, change, changeLabel, status }: StatCardProps) {
  const valueColor = status ? STATUS_COLORS[status] : "var(--rp-text)";
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{
        backgroundColor: "var(--rp-surface)",
        border: "1px solid var(--rp-border)",
      }}
    >
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--rp-text-muted)" }}>
        {label}
      </p>
      <p className="text-3xl font-bold font-mono" style={{ color: valueColor }}>
        {value}
      </p>
      {change !== undefined && (
        <span
          className="text-xs font-medium flex items-center gap-1"
          style={{
            color: isPositive ? "#36cfc9" : isNegative ? "#ff4d4f" : "var(--rp-text-muted)",
          }}
        >
          {isPositive ? "▲" : isNegative ? "▼" : "—"}
          {changeLabel ?? `${Math.abs(change)}%`}
        </span>
      )}
    </div>
  );
}
