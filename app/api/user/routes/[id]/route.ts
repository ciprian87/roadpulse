import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { updateSavedRoute, deleteSavedRoute } from "@/lib/user/route-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { name, is_favorite } = body as { name?: string; is_favorite?: boolean };
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (is_favorite !== undefined) updates.is_favorite = is_favorite;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided", code: "MISSING_FIELDS" }, { status: 400 });
  }

  const updated = await updateSavedRoute(id, session.user.id, updates as Parameters<typeof updateSavedRoute>[2]);
  if (!updated) {
    return NextResponse.json({ error: "Route not found", code: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ route: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const deleted = await deleteSavedRoute(id, session.user.id);
  if (!deleted) {
    return NextResponse.json({ error: "Route not found", code: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
