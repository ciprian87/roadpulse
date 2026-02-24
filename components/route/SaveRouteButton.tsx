"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface SaveRouteButtonProps {
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
}

type DialogState = "closed" | "prompt" | "saving" | "saved" | "signin";

function defaultName(origin: string, destination: string): string {
  // Build "City → City" style name from first segment of each address
  const short = (addr: string) => addr.split(",")[0]?.trim() ?? addr;
  return `${short(origin)} → ${short(destination)}`;
}

export function SaveRouteButton({
  originAddress,
  originLat,
  originLng,
  destinationAddress,
  destinationLat,
  destinationLng,
}: SaveRouteButtonProps) {
  const { data: session } = useSession();
  const [dialog, setDialog] = useState<DialogState>("closed");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openSaveDialog() {
    if (!session) {
      setDialog("signin");
      return;
    }
    setName(defaultName(originAddress, destinationAddress));
    setError(null);
    setDialog("prompt");
  }

  async function handleSave() {
    if (!name.trim()) return;
    setDialog("saving");

    const res = await fetch("/api/user/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        origin_address: originAddress,
        origin_lat: String(originLat),
        origin_lng: String(originLng),
        destination_address: destinationAddress,
        destination_lat: String(destinationLat),
        destination_lng: String(destinationLng),
        is_favorite: false,
      }),
    });

    if (res.ok) {
      setDialog("saved");
      setTimeout(() => setDialog("closed"), 2500);
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to save route.");
      setDialog("prompt");
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={openSaveDialog}
        className="flex items-center gap-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          height: "40px",
          paddingInline: "16px",
          backgroundColor: "color-mix(in srgb, var(--rp-info) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--rp-info) 25%, transparent)",
          color: "var(--rp-info)",
        }}
      >
        <BookmarkIcon />
        Save Route
      </button>

      {/* Modal overlay */}
      {dialog !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setDialog("closed")}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{
              backgroundColor: "var(--rp-surface)",
              border: "1px solid var(--rp-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {dialog === "signin" && (
              <>
                <h2 className="font-semibold mb-2" style={{ color: "var(--rp-text)" }}>
                  Sign in to save routes
                </h2>
                <p className="text-sm mb-4" style={{ color: "var(--rp-text-muted)" }}>
                  Create a free account to save your frequent routes.
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/account/login"
                    className="flex-1 flex items-center justify-center rounded-lg text-sm font-semibold"
                    style={{ height: "44px", backgroundColor: "var(--rp-info)", color: "#fff" }}
                  >
                    Sign In
                  </Link>
                  <button
                    onClick={() => setDialog("closed")}
                    className="flex-1 rounded-lg text-sm"
                    style={{
                      height: "44px",
                      border: "1px solid var(--rp-border)",
                      color: "var(--rp-text-muted)",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {(dialog === "prompt" || dialog === "saving") && (
              <>
                <h2 className="font-semibold mb-1" style={{ color: "var(--rp-text)" }}>
                  Save this route
                </h2>
                <p className="text-xs mb-4" style={{ color: "var(--rp-text-muted)" }}>
                  {originAddress} → {destinationAddress}
                </p>

                {error && (
                  <p className="text-sm mb-3" style={{ color: "var(--rp-critical)" }}>
                    {error}
                  </p>
                )}

                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--rp-text)" }}>
                  Route name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg px-3 text-sm outline-none mb-4"
                  style={{
                    height: "44px",
                    backgroundColor: "var(--rp-surface-2)",
                    border: "1px solid var(--rp-border)",
                    color: "var(--rp-text)",
                  }}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => void handleSave()}
                    disabled={dialog === "saving" || !name.trim()}
                    className="flex-1 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
                    style={{ height: "44px", backgroundColor: "var(--rp-info)", color: "#fff" }}
                  >
                    {dialog === "saving" ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setDialog("closed")}
                    className="flex-1 rounded-lg text-sm"
                    style={{ height: "44px", border: "1px solid var(--rp-border)", color: "var(--rp-text-muted)" }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {dialog === "saved" && (
              <div className="flex flex-col items-center gap-2 py-2">
                <div style={{ color: "var(--rp-clear)", fontSize: "2rem" }}>✓</div>
                <p className="font-semibold" style={{ color: "var(--rp-text)" }}>
                  Route saved!
                </p>
                <p className="text-sm" style={{ color: "var(--rp-text-muted)" }}>
                  Find it in your account
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function BookmarkIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
