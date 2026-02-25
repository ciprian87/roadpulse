"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { TimeAgo } from "@/components/admin/TimeAgo";
import type { UserListRow, UserGrowthPoint, UserSegments } from "@/lib/admin/user-admin-repository";

export default function UsersPage() {
  const [users, setUsers] = useState<UserListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [growth, setGrowth] = useState<UserGrowthPoint[]>([]);
  const [segments, setSegments] = useState<UserSegments | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const LIMIT = 25;

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    const res = await fetch(`/api/admin/users?${params}`);
    const data = (await res.json()) as { users: UserListRow[]; total: number };
    setUsers(data.users);
    setTotal(data.total);
  }, [search, roleFilter, offset]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [, statsRes] = await Promise.allSettled([
        fetchUsers(),
        fetch("/api/admin/users/stats?days=30").then((r) => r.json()),
      ]);
      if (statsRes.status === "fulfilled") {
        const d = statsRes.value as { growth: UserGrowthPoint[]; segments: UserSegments };
        setGrowth(d.growth ?? []);
        setSegments(d.segments ?? null);
      }
      setLoading(false);
    })();
  }, [fetchUsers]);

  async function updateUser(id: string, updates: { role?: string; is_active?: boolean }) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    void fetchUsers();
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <AdminPageHeader title="Users" description="User management, roles, and activity" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={total} />
        <StatCard label="Active Users" value={segments?.active ?? "—"} />
        <StatCard label="Admins" value={segments?.admins ?? "—"} />
        <StatCard label="Drivers" value={segments?.drivers ?? "—"} />
      </div>

      {growth.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)" }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--rp-text)" }}>
            User Growth — Last 30 Days
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--rp-text-muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--rp-text-muted)" }} />
              <Tooltip contentStyle={{ backgroundColor: "var(--rp-surface)", border: "1px solid var(--rp-border)", fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#4096ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search email or name…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: "var(--rp-surface)",
            border: "1px solid var(--rp-border)",
            color: "var(--rp-text)",
          }}
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setOffset(0); }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: "var(--rp-surface)",
            border: "1px solid var(--rp-border)",
            color: "var(--rp-text)",
          }}
        >
          <option value="">All roles</option>
          <option value="driver">Driver</option>
          <option value="dispatcher">Dispatcher</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: "var(--rp-text-muted)" }}>Loading…</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--rp-border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "var(--rp-surface)", borderBottom: "1px solid var(--rp-border)" }}>
                {["Email", "Name", "Role", "Status", "Last Active", "Route Checks", "Reports", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold" style={{ color: "var(--rp-text-muted)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid var(--rp-border)" }}>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--rp-text)" }}>{user.email}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--rp-text-muted)" }}>{user.name ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <select
                      value={user.role}
                      onChange={(e) => void updateUser(user.id, { role: e.target.value })}
                      className="text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: "var(--rp-bg)", border: "1px solid var(--rp-border)", color: "var(--rp-text)" }}
                    >
                      <option value="driver">driver</option>
                      <option value="dispatcher">dispatcher</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs" style={{ color: user.is_active !== false ? "#36cfc9" : "#6a6a8a" }}>
                      {user.is_active !== false ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--rp-text-muted)" }}>
                    <TimeAgo date={user.last_active_at} fallback="Never" />
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-right" style={{ color: "var(--rp-text-muted)" }}>
                    {user.route_check_count}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-right" style={{ color: "var(--rp-text-muted)" }}>
                    {user.report_count}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => void updateUser(user.id, { is_active: user.is_active === false ? true : false })}
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        backgroundColor: user.is_active !== false ? "#ff4d4f15" : "#36cfc915",
                        color: user.is_active !== false ? "#ff4d4f" : "#36cfc9",
                        border: `1px solid ${user.is_active !== false ? "#ff4d4f40" : "#36cfc940"}`,
                      }}
                    >
                      {user.is_active !== false ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--rp-text-muted)" }}>
        <span>Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
            className="px-3 py-1.5 rounded disabled:opacity-40"
            style={{ border: "1px solid var(--rp-border)" }}
          >
            ← Prev
          </button>
          <button
            disabled={offset + LIMIT >= total}
            onClick={() => setOffset((o) => o + LIMIT)}
            className="px-3 py-1.5 rounded disabled:opacity-40"
            style={{ border: "1px solid var(--rp-border)" }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
