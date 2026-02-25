type StatusValue = "healthy" | "degraded" | "down" | "unknown";

interface StatusDotProps {
  status: StatusValue;
  label?: string;
}

const DOT_COLORS: Record<StatusValue, string> = {
  healthy: "#36cfc9",
  degraded: "#ffd000",
  down: "#ff4d4f",
  unknown: "#6a6a8a",
};

export function StatusDot({ status, label }: StatusDotProps) {
  const color = DOT_COLORS[status];
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full flex-none"
        style={{ backgroundColor: color }}
      />
      {label !== undefined ? (
        <span className="text-xs" style={{ color }}>
          {label}
        </span>
      ) : (
        <span className="text-xs" style={{ color }}>
          {status}
        </span>
      )}
    </span>
  );
}
