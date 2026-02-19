"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { SEVERITY_COLOR } from "@/lib/utils/severity";

const SEVERITIES = ["Extreme", "Severe", "Moderate", "Minor"] as const;

export function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("severity");

  const toggle = useCallback(
    (sev: string) => {
      const next = new URLSearchParams(params.toString());
      if (active === sev) {
        next.delete("severity");
      } else {
        next.set("severity", sev);
      }
      router.push(`/alerts?${next.toString()}`);
    },
    [active, params, router]
  );

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {SEVERITIES.map((sev) => {
        const isActive = active === sev;
        const color = SEVERITY_COLOR[sev];
        return (
          <button
            key={sev}
            onClick={() => toggle(sev)}
            className="flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              minHeight: "44px",
              backgroundColor: isActive
                ? `${color}22`
                : "var(--rp-surface-2)",
              color: isActive ? color : "var(--rp-text-muted)",
              border: `1px solid ${isActive ? color : "var(--rp-border)"}`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-none"
              style={{ backgroundColor: color }}
            />
            {sev}
          </button>
        );
      })}
    </div>
  );
}
