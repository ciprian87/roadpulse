import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protect /account/* except the auth pages themselves.
// NextAuth v5 middleware — auth() returns the session or null.
export default auth(function middleware(req: NextRequest & { auth: unknown }) {
  const { pathname } = req.nextUrl;

  // Allow unauthenticated access to login and register pages
  const isAuthPage =
    pathname === "/account/login" || pathname === "/account/register";

  if (isAuthPage) return NextResponse.next();

  // For all other /account/* routes, redirect to login if not signed in
  if (!req.auth) {
    const loginUrl = new URL("/account/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Only run middleware on /account/* routes
  matcher: ["/account/:path*"],
};
