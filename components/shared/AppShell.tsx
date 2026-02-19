"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMapStore } from "@/stores/map-store";

// Nav items shared by mobile bottom bar and desktop sidebar
const NAV_ITEMS = [
  { href: "/", label: "Map", icon: MapIcon },
  { href: "/alerts", label: "Alerts", icon: BellIcon },
  { href: "/route", label: "Route", icon: RouteIcon },
  { href: "/account", label: "Account", icon: UserIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const darkMode = useMapStore((s) => s.darkMode);
  const toggleDarkMode = useMapStore((s) => s.toggleDarkMode);
  const pathname = usePathname();

  // Sync dark/light theme attribute on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", "light");
    }
  }, [darkMode]);

  return (
    <div className="flex flex-col h-screen">
      {/* ── Header ── */}
      <header
        className="flex-none flex items-center justify-between px-4 z-30"
        style={{
          height: "56px",
          backgroundColor: "var(--rp-surface)",
          borderBottom: "1px solid var(--rp-border)",
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg tracking-tight"
          style={{ color: "var(--rp-text)" }}
        >
          <span aria-hidden="true">🛣️</span>
          <span>RoadPulse</span>
        </Link>

        <button
          onClick={toggleDarkMode}
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{
            width: "44px",
            height: "44px",
            color: "var(--rp-text-muted)",
          }}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      {/* ── Main area: sidebar (desktop) + content ── */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <nav
          className="hidden md:flex flex-col items-center py-4 gap-1 flex-none"
          style={{
            width: "64px",
            backgroundColor: "var(--rp-surface)",
            borderRight: "1px solid var(--rp-border)",
          }}
          aria-label="Desktop navigation"
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center rounded-xl transition-colors"
                style={{
                  width: "52px",
                  height: "52px",
                  color: active ? "var(--rp-info)" : "var(--rp-text-muted)",
                  backgroundColor: active
                    ? "color-mix(in srgb, var(--rp-info) 12%, transparent)"
                    : "transparent",
                }}
                aria-label={label}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} />
              </Link>
            );
          })}
        </nav>

        {/* Page content */}
        <main className="flex-1 min-h-0 relative">{children}</main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="flex-none flex md:hidden items-center justify-around"
        style={{
          height: "56px",
          backgroundColor: "var(--rp-surface)",
          borderTop: "1px solid var(--rp-border)",
        }}
        aria-label="Mobile navigation"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 gap-0.5 py-1 transition-colors"
              style={{
                color: active ? "var(--rp-info)" : "var(--rp-text-muted)",
                minHeight: "44px",
              }}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ─── Inline SVG Icons ─────────────────────────────────────────────────── */

function MapIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

function BellIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function RouteIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5c.8 0 1.5-.7 1.5-1.5v0c0-.8-.7-1.5-1.5-1.5H11c-.8 0-1.5-.7-1.5-1.5v0c0-.8.7-1.5 1.5-1.5H18" />
      <circle cx="18" cy="5" r="3" />
      <path d="M15 5H6.5C5.7 5 5 5.7 5 6.5v0C5 7.3 5.7 8 6.5 8H13c.8 0 1.5.7 1.5 1.5v0c0 .8-.7 1.5-1.5 1.5H6" />
    </svg>
  );
}

function UserIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
