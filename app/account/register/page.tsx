"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
    });
    setLoading(false);

    if (res.ok) {
      router.push("/account/login?registered=1");
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Registration failed. Please try again.");
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
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--rp-text)" }}>
          Create Account
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--rp-text-muted)" }}>
          Save routes and get a personalised experience
        </p>

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
          {(
            [
              { id: "name", label: "Full Name", type: "text", value: name, setter: setName, placeholder: "Jane Smith", autoComplete: "name" },
              { id: "email", label: "Email", type: "email", value: email, setter: setEmail, placeholder: "you@example.com", autoComplete: "email" },
              { id: "password", label: "Password", type: "password", value: password, setter: setPassword, placeholder: "Min 8 characters", autoComplete: "new-password" },
              { id: "confirm", label: "Confirm Password", type: "password", value: confirm, setter: setConfirm, placeholder: "••••••••", autoComplete: "new-password" },
            ] as const
          ).map(({ id, label, type, value, setter, placeholder, autoComplete }) => (
            <div key={id} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-sm font-medium" style={{ color: "var(--rp-text)" }}>
                {label}
              </label>
              <input
                id={id}
                type={type}
                autoComplete={autoComplete}
                required
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="rounded-lg px-3 text-sm outline-none"
                style={{
                  height: "44px",
                  backgroundColor: "var(--rp-surface-2)",
                  border: "1px solid var(--rp-border)",
                  color: "var(--rp-text)",
                }}
                placeholder={placeholder}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60"
            style={{ height: "44px", backgroundColor: "var(--rp-info)", color: "#fff" }}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-center mt-4" style={{ color: "var(--rp-text-muted)" }}>
          Already have an account?{" "}
          <Link href="/account/login" className="font-medium" style={{ color: "var(--rp-info)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
