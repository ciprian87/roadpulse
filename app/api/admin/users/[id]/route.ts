import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth-guard";
import { getUserDetail, updateUser } from "@/lib/admin/user-admin-repository";
import { logUsageEvent } from "@/lib/admin/usage-repository";
import { getAdminSession } from "@/lib/admin/auth-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  try {
    const user = await getUserDetail(id);
    if (!user) {
      return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "QUERY_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

interface UpdateUserBody {
  role?: string;
  is_active?: boolean;
}

const VALID_ROLES = new Set(["driver", "dispatcher", "admin"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const session = await getAdminSession();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { role, is_active } = body as Partial<UpdateUserBody>;

  if (role !== undefined && !VALID_ROLES.has(role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${[...VALID_ROLES].join(", ")}`, code: "INVALID_ROLE" },
      { status: 400 }
    );
  }

  try {
    await updateUser(id, { role, is_active });
    await logUsageEvent(
      "MODERATION",
      { targetUserId: id, changes: { role, is_active } },
      session?.user?.id ?? null
    ).catch(() => undefined);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "UPDATE_FAILED";
    return NextResponse.json({ error: msg, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
