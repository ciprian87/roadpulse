import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminSession } from "@/lib/admin/auth-guard";
import {
  getQueueStatus,
  pauseIngestion,
  resumeIngestion,
  triggerImmediate,
  setRepeatInterval,
} from "@/lib/jobs/ingestion-queue";
import { logUsageEvent } from "@/lib/admin/usage-repository";
import { setSetting } from "@/lib/admin/settings-repository";

export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const status = await getQueueStatus();
    return NextResponse.json(status);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUEUE_UNAVAILABLE";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

interface JobActionBody {
  action: "pause" | "resume" | "trigger" | "set-interval";
  intervalMinutes?: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await getAdminSession();
  const userId = session?.user?.id ?? null;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { action, intervalMinutes } = body as JobActionBody;

  try {
    switch (action) {
      case "pause":
        await pauseIngestion();
        await logUsageEvent("SCHEDULER_PAUSE", {}, userId).catch(() => undefined);
        return NextResponse.json({ success: true });

      case "resume":
        await resumeIngestion();
        await logUsageEvent("SCHEDULER_RESUME", {}, userId).catch(() => undefined);
        return NextResponse.json({ success: true });

      case "trigger":
        await triggerImmediate();
        await logUsageEvent("FEED_INGEST", { trigger: "manual" }, userId).catch(() => undefined);
        return NextResponse.json({ success: true });

      case "set-interval": {
        if (typeof intervalMinutes !== "number" || intervalMinutes < 1) {
          return NextResponse.json(
            { error: "intervalMinutes must be a number >= 1", code: "INVALID_BODY" },
            { status: 400 }
          );
        }
        await setRepeatInterval(intervalMinutes);
        await setSetting("feed_default_interval_minutes", intervalMinutes, userId ?? undefined);
        await logUsageEvent(
          "SCHEDULER_INTERVAL_CHANGE",
          { intervalMinutes },
          userId
        ).catch(() => undefined);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${String(action)}`, code: "INVALID_ACTION" },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "ACTION_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
