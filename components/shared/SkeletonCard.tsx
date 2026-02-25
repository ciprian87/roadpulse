"use client";

interface SkeletonCardProps {
  lines?: number;
  height?: number;
}

/** Animated skeleton placeholder for loading states */
export function SkeletonCard({ lines = 3, height }: SkeletonCardProps) {
  return (
    <div
      className="rounded-xl p-4 space-y-3 overflow-hidden"
      style={{
        backgroundColor: "var(--rp-surface)",
        border: "1px solid var(--rp-border)",
        height: height ? `${height}px` : undefined,
      }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="rounded animate-pulse"
          style={{
            height: "12px",
            // First line is wider (like a heading), subsequent lines slightly narrower
            width: i === 0 ? "60%" : i === lines - 1 ? "40%" : "85%",
            backgroundColor: "var(--rp-border)",
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}
