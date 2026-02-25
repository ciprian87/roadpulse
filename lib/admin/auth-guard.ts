import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

/** Returns null if admin, or a 401/403 response if not. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required", code: "FORBIDDEN" },
      { status: 403 }
    );
  }
  return null;
}

export async function getAdminSession() {
  const session = await auth();
  return session;
}
