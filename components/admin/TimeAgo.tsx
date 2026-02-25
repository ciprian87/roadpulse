"use client";

import { useEffect, useState } from "react";

interface TimeAgoProps {
  date: string | Date | null | undefined;
  fallback?: string;
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffM = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffM / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMs < 0) return "just now";
  if (diffM < 2) return "just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  return `${diffD}d ago`;
}

export function TimeAgo({ date, fallback = "Never" }: TimeAgoProps) {
  const [label, setLabel] = useState<string>(() => {
    if (!date) return fallback;
    return formatRelative(new Date(date));
  });

  useEffect(() => {
    if (!date) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLabel(fallback);
      return;
    }
    const parsed = new Date(date);
    setLabel(formatRelative(parsed));
    const interval = setInterval(() => setLabel(formatRelative(parsed)), 30_000);
    return () => clearInterval(interval);
  }, [date, fallback]);

  return <span title={date ? new Date(date).toLocaleString() : fallback}>{label}</span>;
}
