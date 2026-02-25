"use client";

import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onSort,
  sortKey,
  sortDir,
  emptyMessage = "No data to display.",
}: DataTableProps<T>) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--rp-border)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr
              style={{
                backgroundColor: "var(--rp-surface)",
                borderBottom: "1px solid var(--rp-border)",
              }}
            >
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-3 py-2 text-xs font-semibold select-none"
                  style={{
                    color: "var(--rp-text-muted)",
                    cursor: col.sortable && onSort ? "pointer" : "default",
                    whiteSpace: "nowrap",
                  }}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-sm"
                  style={{ color: "var(--rp-text-muted)" }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid var(--rp-border)" }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-2.5"
                      style={{ color: "var(--rp-text)" }}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
