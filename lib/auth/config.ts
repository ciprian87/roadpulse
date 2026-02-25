// Full NextAuth config for Node.js runtime (API routes, server components).
// Extends the edge-safe base config with the Credentials provider.
// Do NOT import this from middleware.ts — use lib/auth/auth.config.ts there.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/auth/user-repository";
import { authConfig } from "@/lib/auth/auth.config";
import { checkRateLimit } from "@/lib/middleware/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        // 10 attempts per 15-minute window per email — brute-force protection.
        // Fail open if Redis is unavailable to avoid locking out legitimate users.
        const rl = await checkRateLimit(
          `rl:login:${email.toLowerCase()}`,
          10,
          900
        ).catch(() => ({ allowed: true }));
        if (!rl.allowed) return null;

        const user = await getUserByEmail(email);
        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
});
