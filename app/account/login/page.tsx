"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/account";
  const registered = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-full p-4"
      style={{ backgroundColor: "var(--rp-bg)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          backgroundColor: "var(--rp-surface)",
          border: "1px solid var(--rp-border)",
        }}
      >
        <h1
          className="text-xl font-bold mb-1"
          style={{ color: "var(--rp-text)" }}
        >
          Sign In
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--rp-text-muted)" }}>
          Access your saved routes and preferences
        </p>

        {registered && (
          <div
            className="rounded-lg px-4 py-3 mb-4 text-sm"
            style={{
              backgroundColor: "color-mix(in srgb, var(--rp-clear) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--rp-clear) 30%, transparent)",
              color: "var(--rp-clear)",
            }}
          >
            Account created — sign in below.
          </div>
        )}

        {error && (
          <div
            className="rounded-lg px-4 py-3 mb-4 text-sm"
            style={{
              backgroundColor: "color-mix(in srgb, var(--rp-critical) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--rp-critical) 30%, transparent)",
              color: "var(--rp-critical)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium"
              style={{ color: "var(--rp-text)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg px-3 text-sm outline-none transition-all"
              style={{
                height: "44px",
                backgroundColor: "var(--rp-surface-2)",
                border: "1px solid var(--rp-border)",
                color: "var(--rp-text)",
              }}
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium"
              style={{ color: "var(--rp-text)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg px-3 text-sm outline-none"
              style={{
                height: "44px",
                backgroundColor: "var(--rp-surface-2)",
                border: "1px solid var(--rp-border)",
                color: "var(--rp-text)",
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60"
            style={{
              height: "44px",
              backgroundColor: "var(--rp-info)",
              color: "#fff",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-center mt-4" style={{ color: "var(--rp-text-muted)" }}>
          No account?{" "}
          <Link
            href="/account/register"
            className="font-medium"
            style={{ color: "var(--rp-info)" }}
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
