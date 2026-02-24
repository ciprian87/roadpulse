// Middleware runs in the Edge runtime — must only import edge-compatible modules.
// We use the base authConfig (no pg, no bcrypt) with NextAuth's built-in JWT
// verification. The authorized() callback in authConfig handles the redirect logic.
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

export const { auth: middleware } = NextAuth(authConfig);
export default middleware;

export const config = {
  matcher: ["/account/:path*"],
};
