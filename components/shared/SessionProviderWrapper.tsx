"use client";

// Thin client wrapper so that layout.tsx (a server component) can use SessionProvider.
// Any component in the tree can call useSession() after this wraps them.
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
