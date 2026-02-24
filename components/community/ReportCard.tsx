"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { severityToColor } from "@/lib/utils/severity";
import { REPORT_TYPE_SHORT } from "@/lib/types/community";
import type { CommunityReportApiItem, CommunityReportType } from "@/lib/types/community";

interface ReportCardProps {
  report: CommunityReportApiItem;
  onVote?: (reportId: string, newUpvotes: number, newDownvotes: number, userVote: "up" | "down" | null) => void;
}

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffM = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffM / 60);
  if (diffM < 2) return "Just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export function ReportCard({ report, onVote }: ReportCardProps) {
  const { data: session } = useSession();
  const [upvotes, setUpvotes] = useState(report.upvotes);
  const [downvotes, setDownvotes] = useState(report.downvotes);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(report.user_vote ?? null);
  const [voting, setVoting] = useState(false);

  const color = severityToColor(report.severity);
  const netVotes = upvotes - downvotes;
  const typeLabel = REPORT_TYPE_SHORT[report.type as CommunityReportType] ?? report.type;

  async function handleVote(vote: "up" | "down") {
    if (!session || voting) return;
    setVoting(true);

    const res = await fetch(`/api/reports/${report.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        upvotes: number;
        downvotes: number;
        user_vote: "up" | "down" | null;
      };
      setUpvotes(data.upvotes);
      setDownvotes(data.downvotes);
      setUserVote(data.user_vote);
      onVote?.(report.id, data.upvotes, data.downvotes, data.user_vote);
    }

    setVoting(false);
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--rp-surface)",
        borderLeft: `3px solid ${color}`,
        border: `1px solid var(--rp-border)`,
        borderLeftWidth: "3px",
        borderLeftColor: color,
      }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Type chip + time */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${color}20`,
                  color: color,
                  border: `1px solid ${color}40`,
                }}
              >
                {typeLabel}
              </span>
              <span className="text-xs" style={{ color: "var(--rp-text-muted)" }}>
                {timeAgo(report.created_at)}
              </span>
            </div>

            {/* Title */}
            <p className="text-sm font-semibold leading-snug" style={{ color: "var(--rp-text)" }}>
              {report.title}
            </p>

            {/* Location */}
            {(report.location_description ?? report.route_name) && (
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--rp-text-muted)" }}>
                {[report.location_description, report.route_name].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {/* Verified badge */}
          {netVotes >= 3 && (
            <span className="text-xs font-medium flex-none" style={{ color: "var(--rp-clear)" }}>
              ✅ Verified
            </span>
          )}
        </div>

        {/* Description (truncated) */}
        {report.description && (
          <p className="text-xs mt-1.5 line-clamp-2" style={{ color: "var(--rp-text-muted)" }}>
            {report.description}
          </p>
        )}
      </div>

      {/* Vote bar */}
      <div
        className="flex items-center gap-1 px-3 py-2"
        style={{ borderTop: "1px solid var(--rp-border)" }}
      >
        <span className="text-xs mr-1" style={{ color: "var(--rp-text-muted)" }}>
          Helpful?
        </span>
        <button
          onClick={() => void handleVote("up")}
          disabled={!session || voting}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor:
              userVote === "up"
                ? "color-mix(in srgb, var(--rp-clear) 20%, transparent)"
                : "var(--rp-surface-2)",
            color: userVote === "up" ? "var(--rp-clear)" : "var(--rp-text-muted)",
            border: `1px solid ${userVote === "up" ? "color-mix(in srgb, var(--rp-clear) 40%, transparent)" : "var(--rp-border)"}`,
          }}
          aria-label="Upvote"
          title={session ? "Upvote" : "Sign in to vote"}
        >
          👍 {upvotes}
        </button>
        <button
          onClick={() => void handleVote("down")}
          disabled={!session || voting}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor:
              userVote === "down"
                ? "color-mix(in srgb, var(--rp-critical) 20%, transparent)"
                : "var(--rp-surface-2)",
            color: userVote === "down" ? "var(--rp-critical)" : "var(--rp-text-muted)",
            border: `1px solid ${userVote === "down" ? "color-mix(in srgb, var(--rp-critical) 40%, transparent)" : "var(--rp-border)"}`,
          }}
          aria-label="Downvote"
          title={session ? "Downvote" : "Sign in to vote"}
        >
          👎 {downvotes}
        </button>
        {!session && (
          <span className="text-xs ml-1" style={{ color: "var(--rp-text-muted)" }}>
            · Sign in to vote
          </span>
        )}
      </div>
    </div>
  );
}
