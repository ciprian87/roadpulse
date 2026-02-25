import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Access Denied — RoadPulse Admin" };

export default function AccessDeniedPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
      style={{ backgroundColor: "var(--rp-bg)", color: "var(--rp-text)" }}
    >
      <div className="text-center space-y-2">
        <p className="text-6xl font-bold" style={{ color: "#ff4d4f" }}>403</p>
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p style={{ color: "var(--rp-text-muted)" }}>
          You do not have admin privileges to access this page.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/"
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#4096ff", color: "#ffffff" }}
        >
          Back to App
        </Link>
        <Link
          href="/account/login"
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            border: "1px solid var(--rp-border)",
            color: "var(--rp-text-muted)",
          }}
        >
          Log in with a different account
        </Link>
      </div>
    </div>
  );
}
