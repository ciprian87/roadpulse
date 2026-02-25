import { TimeAgo } from "./TimeAgo";

export interface ActivityEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const TYPE_ICONS: Record<string, string> = {
  FEED_INGEST: "📡",
  USER_REGISTER: "👤",
  USER_LOGIN: "🔑",
  ROUTE_CHECK: "🗺️",
  REPORT_SUBMIT: "📝",
  FEED_ERROR: "⚠️",
  MODERATION: "🔨",
};

function getIcon(type: string): string {
  return TYPE_ICONS[type] ?? "📌";
}

interface ActivityFeedProps {
  events: ActivityEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: "var(--rp-text-muted)" }}>
        No recent activity.
      </p>
    );
  }

  return (
    <div className="divide-y" style={{ borderColor: "var(--rp-border)" }}>
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-3 py-2.5 px-1">
          <span className="text-base mt-0.5 flex-none">{getIcon(event.type)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate" style={{ color: "var(--rp-text)" }}>
              {event.description}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--rp-text-muted)" }}>
              <TimeAgo date={event.timestamp} />
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
