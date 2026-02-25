import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getPreferences, setPreferences } from "@/lib/user/preferences-repository";
import type { UserPreferences } from "@/lib/user/preferences-repository";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const preferences = await getPreferences(session.user.id);
  return NextResponse.json({ preferences });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
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

  const { theme, defaultRegion } = body as Partial<UserPreferences>;
  const updates: Partial<UserPreferences> = {};

  if (theme !== undefined) {
    if (!["dark", "light", "system"].includes(theme)) {
      return NextResponse.json(
        { error: "theme must be dark, light, or system", code: "INVALID_THEME" },
        { status: 400 }
      );
    }
    updates.theme = theme;
  }

  if (defaultRegion !== undefined) {
    if (typeof defaultRegion !== "string" || defaultRegion.length > 100) {
      return NextResponse.json(
        { error: "defaultRegion must be a string of at most 100 characters", code: "INVALID_REGION" },
        { status: 400 }
      );
    }
    updates.defaultRegion = defaultRegion;
  }

  const preferences = await setPreferences(session.user.id, updates);
  return NextResponse.json({ preferences });
}
