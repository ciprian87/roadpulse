"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "◉" },
  { href: "/admin/feed-health", label: "Feed Health", icon: "📡" },
  { href: "/admin/data-quality", label: "Data Quality", icon: "✔" },
  { href: "/admin/users", label: "Users", icon: "👤" },
  { href: "/admin/moderation", label: "Moderation", icon: "🔨" },
  { href: "/admin/analytics", label: "Analytics", icon: "📊" },
  { href: "/admin/system", label: "System", icon: "⚙" },
  { href: "/admin/settings", label: "Settings", icon: "🔧" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-5 border-b" style={{ borderColor: "var(--rp-border)" }}>
        <Link href="/admin" className="flex items-center gap-2">
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: "var(--rp-text)" }}
          >
            RoadPulse
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ backgroundColor: "#ff4d4f22", color: "#ff4d4f" }}
          >
            ADMIN
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          // Exact match for overview, prefix match for sub-sections
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--rp-info) 15%, transparent)"
                  : undefined,
                color: isActive ? "var(--rp-info)" : "var(--rp-text-muted)",
              }}
            >
              <span className="text-base w-5 text-center flex-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t text-xs" style={{ borderColor: "var(--rp-border)", color: "var(--rp-text-muted)" }}>
        <Link href="/" className="hover:underline">← Back to App</Link>
      </div>
    </nav>
  );
}
