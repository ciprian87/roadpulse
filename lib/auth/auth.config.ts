// Edge-compatible NextAuth config — no Node.js-only imports (no pg, no bcrypt).
// Used by middleware.ts which runs in the Edge runtime.
// lib/auth/config.ts extends this with the Credentials provider for Node.js contexts.
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" as const },

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      // Login and register pages are always accessible
      if (pathname === "/account/login" || pathname === "/account/register") return true;
      // All other /account/* routes require a valid session
      const isLoggedIn = !!auth?.user;
      if (!isLoggedIn) return false; // NextAuth redirects to pages.signIn
      return true;
    },
  },

  pages: {
    signIn: "/account/login",
  },

  // Providers are added in lib/auth/config.ts — none here to keep this edge-safe
  providers: [],
} satisfies NextAuthConfig;
