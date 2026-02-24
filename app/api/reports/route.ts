import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import {
  listReports,
  createReport,
  isWithinUS,
} from "@/lib/community/report-repository";
import { checkReportRateLimit } from "@/lib/community/rate-limit";
import type { CommunityReportType } from "@/lib/types/community";

const VALID_TYPES = new Set<CommunityReportType>([
  "ROAD_HAZARD",
  "CLOSURE_UPDATE",
  "WEATHER_CONDITION",
  "WAIT_TIME",
  "PARKING_FULL",
  "OTHER",
]);

const VALID_SEVERITIES = new Set(["INFO", "ADVISORY", "WARNING"]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const p = req.nextUrl.searchParams;
  const session = await auth();

  const reports = await listReports({
    state: p.get("state") ?? undefined,
    type: p.get("type") ?? undefined,
    bbox: p.get("bbox") ?? undefined,
    limit: p.get("limit") ? parseInt(p.get("limit")!) : undefined,
    offset: p.get("offset") ? parseInt(p.get("offset")!) : undefined,
    userId: session?.user.id,
  });

  return NextResponse.json({ reports });
}

interface ReportBody {
  type: string;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  location_description?: string;
  route_name?: string;
  state?: string;
  severity?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { type, title, description, lat, lng, location_description, route_name, state, severity } =
    body as Partial<ReportBody>;

  // Validate required fields
  if (!type || !title?.trim()) {
    return NextResponse.json(
      { error: "type and title are required", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  if (!VALID_TYPES.has(type as CommunityReportType)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${[...VALID_TYPES].join(", ")}`, code: "INVALID_TYPE" },
      { status: 400 }
    );
  }

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json(
      { error: "lat and lng are required numeric values", code: "MISSING_LOCATION" },
      { status: 400 }
    );
  }

  if (!isWithinUS(lat, lng)) {
    return NextResponse.json(
      { error: "Location must be within the United States", code: "OUT_OF_BOUNDS" },
      { status: 400 }
    );
  }

  const resolvedSeverity = severity && VALID_SEVERITIES.has(severity) ? severity : "INFO";

  // Rate limit — max 10 reports per user per hour
  const allowed = await checkReportRateLimit(session.user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: "You've submitted too many reports. Try again in an hour.", code: "RATE_LIMITED", retryAfter: 3600 },
      { status: 429 }
    );
  }

  const report = await createReport(session.user.id, {
    type: type as CommunityReportType,
    title: title.trim(),
    description,
    lat,
    lng,
    location_description,
    route_name,
    state,
    severity: resolvedSeverity,
  });

  return NextResponse.json({ report }, { status: 201 });
}
