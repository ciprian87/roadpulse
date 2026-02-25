import type { Metadata } from "next";
import { auth } from "@/lib/auth/config";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata: Metadata = {
  title: { template: "%s — RoadPulse Admin", default: "Admin Dashboard — RoadPulse" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const adminName = session?.user?.name ?? session?.user?.email ?? "Admin";

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--rp-bg)" }}>
      {/* Sidebar */}
      <aside
        className="w-60 flex-none flex flex-col h-full border-r"
        style={{ backgroundColor: "var(--rp-surface)", borderColor: "var(--rp-border)" }}
      >
        <AdminSidebar />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center justify-between px-6 py-3 border-b flex-none"
          style={{
            backgroundColor: "var(--rp-surface)",
            borderColor: "var(--rp-border)",
          }}
        >
          <div />
          <div className="flex items-center gap-3 text-sm" style={{ color: "var(--rp-text-muted)" }}>
            <span>{adminName}</span>
            <span
              className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{ backgroundColor: "#4096ff22", color: "#4096ff" }}
            >
              admin
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
