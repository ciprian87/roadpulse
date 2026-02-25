// Middleware runs in the Edge runtime — must only import edge-compatible modules.
// We use the base authConfig (no pg, no bcrypt) with NextAuth's built-in JWT
// verification. The authorized() callback in authConfig handles /account/* redirects.
// Admin routes get an explicit role check here because we need to inspect the role
// from the JWT token, which is available on the augmented request from NextAuth.
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { type NextRequest, NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  // req.auth is the session from NextAuth's JWT — available on edge runtime
  const session = req.auth as { user?: { role?: string } } | null;

  // API routes return JSON — never redirect them to a login page
  if (pathname.startsWith("/api/admin")) {
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
    return; // authorized — proceed to the route handler
  }

  if (pathname.startsWith("/admin")) {
    if (!session?.user) {
      const loginUrl = new URL("/account/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/access-denied", req.url));
    }
  }

  // /account/* routes are handled by the authorized() callback in authConfig
}) as (req: NextRequest) => Response | undefined;

export const config = {
  // /api/admin/* added so the edge auth check provides defense-in-depth alongside
  // the requireAdmin() guards in individual route handlers.
  matcher: ["/account/:path*", "/admin/:path*", "/api/admin/:path*"],
};
