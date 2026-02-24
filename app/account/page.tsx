"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { SavedRoute } from "@/lib/db/schema";
import type { UserPreferences } from "@/lib/user/preferences-repository";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/account/login");
    }
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="flex items-center justify-center min-h-full" style={{ color: "var(--rp-text-muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div
      className="min-h-full overflow-y-auto p-4 md:p-6"
      style={{ backgroundColor: "var(--rp-bg)" }}
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <AccountHeader name={session.user.name} email={session.user.email} />
        <SavedRoutesSection />
        <PreferencesSection />
      </div>
    </div>
  );
}

/* ─── Account Header ──────────────────────────────────────────────────────── */

function AccountHeader({ name, email }: { name: string | null; email: string }) {
  return (
    <div
      className="rounded-2xl p-5 flex items-center justify-between"
      style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
    >
      <div className="flex items-center gap-4">
        {/* Avatar initial */}
        <div
          className="rounded-full flex items-center justify-center font-bold text-lg flex-none"
          style={{
            width: "48px",
            height: "48px",
            backgroundColor: "color-mix(in srgb, var(--rp-info) 20%, transparent)",
            color: "var(--rp-info)",
          }}
        >
          {(name ?? email).charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold" style={{ color: "var(--rp-text)" }}>
            {name ?? "Driver"}
          </p>
          <p className="text-sm" style={{ color: "var(--rp-text-muted)" }}>
            {email}
          </p>
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-sm font-medium rounded-lg px-4 transition-colors"
        style={{
          height: "36px",
          border: "1px solid var(--rp-border)",
          color: "var(--rp-text-muted)",
        }}
      >
        Sign out
      </button>
    </div>
  );
}

/* ─── Saved Routes ────────────────────────────────────────────────────────── */

function SavedRoutesSection() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Increment this to trigger a re-fetch after mutations
  const [fetchTick, setFetchTick] = useState(0);

  useEffect(() => {
    fetch("/api/user/routes")
      .then((r) => r.json())
      .then((data: { routes: SavedRoute[] }) => {
        setRoutes(data.routes);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [fetchTick]);

  async function toggleFavorite(route: SavedRoute) {
    const res = await fetch(`/api/user/routes/${route.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: !route.is_favorite }),
    });
    if (res.ok) {
      setRoutes((prev) =>
        prev
          .map((r) => (r.id === route.id ? { ...r, is_favorite: !r.is_favorite } : r))
          .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite))
      );
    }
  }

  async function deleteRoute(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/user/routes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRoutes((prev) => prev.filter((r) => r.id !== id));
    }
    setDeletingId(null);
  }

  function refetch() {
    setFetchTick((t) => t + 1);
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-3" style={{ color: "var(--rp-text)" }}>
        Saved Routes
      </h2>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--rp-border)" }}
      >
        {loading ? (
          <div
            className="p-6 text-sm text-center"
            style={{ color: "var(--rp-text-muted)", backgroundColor: "var(--rp-surface)" }}
          >
            Loading routes…
          </div>
        ) : routes.length === 0 ? (
          <div
            className="p-6 text-sm text-center"
            style={{ color: "var(--rp-text-muted)", backgroundColor: "var(--rp-surface)" }}
          >
            No saved routes yet. Check a route and tap{" "}
            <span className="font-medium" style={{ color: "var(--rp-text)" }}>
              Save Route
            </span>{" "}
            to add one.
          </div>
        ) : (
          <ul>
            {routes.map((route, i) => (
              <li
                key={route.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  backgroundColor: "var(--rp-surface)",
                  borderTop: i > 0 ? "1px solid var(--rp-border)" : undefined,
                }}
              >
                {/* Favorite toggle */}
                <button
                  onClick={() => void toggleFavorite(route)}
                  className="flex-none transition-colors"
                  style={{ color: route.is_favorite ? "var(--rp-warning)" : "var(--rp-border)" }}
                  aria-label={route.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <StarIcon filled={route.is_favorite} />
                </button>

                {/* Route info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: "var(--rp-text)" }}>
                    {route.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--rp-text-muted)" }}>
                    {route.origin_address} → {route.destination_address}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-none">
                  <CheckRouteButton route={route} onChecked={refetch} />
                  <button
                    onClick={() => void deleteRoute(route.id)}
                    disabled={deletingId === route.id}
                    className="rounded-lg text-xs px-2 transition-colors disabled:opacity-50"
                    style={{
                      height: "32px",
                      border: "1px solid color-mix(in srgb, var(--rp-critical) 40%, transparent)",
                      color: "var(--rp-critical)",
                    }}
                    aria-label="Delete route"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CheckRouteButton({
  route,
  onChecked,
}: {
  route: SavedRoute;
  onChecked: () => void;
}) {
  const router = useRouter();

  function handleCheck() {
    // Update last_checked_at and navigate to /route with query params
    void fetch(`/api/user/routes/${route.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_checked_at: new Date().toISOString() }),
    }).then(() => onChecked());

    const params = new URLSearchParams({
      origin: route.origin_address,
      olat: route.origin_lat,
      olng: route.origin_lng,
      dest: route.destination_address,
      dlat: route.destination_lat,
      dlng: route.destination_lng,
    });
    router.push(`/route?${params.toString()}`);
  }

  return (
    <button
      onClick={handleCheck}
      className="rounded-lg text-xs font-medium px-3 transition-colors"
      style={{
        height: "32px",
        backgroundColor: "color-mix(in srgb, var(--rp-info) 15%, transparent)",
        border: "1px solid color-mix(in srgb, var(--rp-info) 30%, transparent)",
        color: "var(--rp-info)",
      }}
    >
      Check Now
    </button>
  );
}

/* ─── Preferences ─────────────────────────────────────────────────────────── */

function PreferencesSection() {
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((data: { preferences: UserPreferences }) => {
        setTheme(data.preferences.theme ?? "dark");
      })
      .catch(() => {
        // Non-fatal — keep default theme
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-3" style={{ color: "var(--rp-text)" }}>
        Preferences
      </h2>

      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" style={{ color: "var(--rp-text)" }}>
            Theme
          </label>
          <div className="flex gap-2">
            {(["dark", "light", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className="flex-1 rounded-lg text-sm font-medium capitalize transition-colors"
                style={{
                  height: "40px",
                  backgroundColor:
                    theme === t
                      ? "color-mix(in srgb, var(--rp-info) 20%, transparent)"
                      : "var(--rp-surface-2)",
                  border:
                    theme === t
                      ? "1px solid color-mix(in srgb, var(--rp-info) 50%, transparent)"
                      : "1px solid var(--rp-border)",
                  color: theme === t ? "var(--rp-info)" : "var(--rp-text-muted)",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60 self-end"
          style={{
            height: "40px",
            paddingInline: "24px",
            backgroundColor: saved ? "var(--rp-clear)" : "var(--rp-info)",
            color: "#fff",
          }}
        >
          {saving ? "Saving…" : saved ? "Saved!" : "Save Preferences"}
        </button>
      </div>
    </section>
  );
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
