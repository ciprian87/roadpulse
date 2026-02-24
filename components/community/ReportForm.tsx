"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { REPORT_TYPE_LABELS, REPORT_TYPE_SHORT } from "@/lib/types/community";
import type { CommunityReportType } from "@/lib/types/community";

interface ReportFormProps {
  onClose: () => void;
  /** Called after a successful submission with the new report id */
  onSubmitted?: (reportId: string) => void;
}

type Step = "type" | "location" | "details" | "confirm";

interface FormState {
  type: CommunityReportType | null;
  lat: number | null;
  lng: number | null;
  locationDescription: string;
  routeName: string;
  title: string;
  description: string;
  severity: "INFO" | "ADVISORY" | "WARNING";
}

const INITIAL: FormState = {
  type: null,
  lat: null,
  lng: null,
  locationDescription: "",
  routeName: "",
  title: "",
  description: "",
  severity: "ADVISORY",
};

const SEVERITY_OPTIONS: Array<{ value: "INFO" | "ADVISORY" | "WARNING"; label: string; color: string }> = [
  { value: "INFO",     label: "Low",    color: "#4096ff" },
  { value: "ADVISORY", label: "Medium", color: "#ffd000" },
  { value: "WARNING",  label: "High",   color: "#ff8c00" },
];

const REPORT_TYPES: CommunityReportType[] = [
  "ROAD_HAZARD",
  "CLOSURE_UPDATE",
  "WEATHER_CONDITION",
  "WAIT_TIME",
  "PARKING_FULL",
  "OTHER",
];

export function ReportForm({ onClose, onSubmitted }: ReportFormProps) {
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>("type");
  const [form, setForm] = useState<FormState>(INITIAL);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    if (step === "type") setStep("location");
    else if (step === "location") setStep("details");
    else if (step === "details") setStep("confirm");
  }

  function goBack() {
    if (step === "location") setStep("type");
    else if (step === "details") setStep("location");
    else if (step === "confirm") setStep("details");
  }

  function detectLocation() {
    if (!("geolocation" in navigator)) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        update("lat", coords.latitude);
        update("lng", coords.longitude);
        setLocating(false);
      },
      () => {
        setLocError("Could not get your location. Please check location permissions.");
        setLocating(false);
      },
      { timeout: 10_000 }
    );
  }

  async function handleSubmit() {
    if (!form.type || form.lat === null || form.lng === null || !form.title.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        lat: form.lat,
        lng: form.lng,
        location_description: form.locationDescription.trim() || null,
        route_name: form.routeName.trim() || null,
        severity: form.severity,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { id: string };
      onSubmitted?.(data.id);
      onClose();
    } else {
      const err = (await res.json().catch(() => ({ error: "Unknown error" }))) as { error?: string };
      setSubmitError(err.error ?? "Failed to submit report. Please try again.");
    }

    setSubmitting(false);
  }

  const stepIndex = { type: 0, location: 1, details: 2, confirm: 3 }[step];

  return (
    // Modal backdrop
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ zIndex: 2000, backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: "var(--rp-surface)", maxHeight: "90dvh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-none"
          style={{ borderBottom: "1px solid var(--rp-border)" }}
        >
          <div className="flex items-center gap-3">
            {step !== "type" && (
              <button
                onClick={goBack}
                className="flex items-center justify-center rounded-lg"
                style={{ width: "32px", height: "32px", color: "var(--rp-text-muted)" }}
                aria-label="Go back"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--rp-text)" }}>
                Report a Condition
              </p>
              <p className="text-xs" style={{ color: "var(--rp-text-muted)" }}>
                Step {stepIndex + 1} of 4
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg"
            style={{ width: "36px", height: "36px", color: "var(--rp-text-muted)" }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 flex-none" style={{ backgroundColor: "var(--rp-border)" }}>
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${((stepIndex + 1) / 4) * 100}%`,
              backgroundColor: "var(--rp-info)",
            }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === "type" && (
            <TypeStep
              selected={form.type}
              onSelect={(type) => {
                update("type", type);
                setStep("location");
              }}
            />
          )}
          {step === "location" && (
            <LocationStep
              lat={form.lat}
              lng={form.lng}
              locationDescription={form.locationDescription}
              routeName={form.routeName}
              locating={locating}
              locError={locError}
              onDetect={detectLocation}
              onDescriptionChange={(v) => update("locationDescription", v)}
              onRouteNameChange={(v) => update("routeName", v)}
            />
          )}
          {step === "details" && (
            <DetailsStep
              title={form.title}
              description={form.description}
              severity={form.severity}
              onTitleChange={(v) => update("title", v)}
              onDescriptionChange={(v) => update("description", v)}
              onSeverityChange={(v) => update("severity", v)}
            />
          )}
          {step === "confirm" && (
            <ConfirmStep
              form={form}
              error={submitError}
            />
          )}
        </div>

        {/* Footer */}
        {step !== "type" && (
          <div
            className="flex-none px-4 py-3"
            style={{ borderTop: "1px solid var(--rp-border)" }}
          >
            {!session && (
              <p className="text-xs text-center mb-2" style={{ color: "var(--rp-critical)" }}>
                You must be signed in to submit reports.
              </p>
            )}
            {step === "confirm" ? (
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting || !session}
                className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "var(--rp-info)", color: "#ffffff" }}
              >
                {submitting ? "Submitting…" : "Submit Report"}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={
                  (step === "location" && form.lat === null) ||
                  (step === "details" && !form.title.trim())
                }
                className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "var(--rp-info)", color: "#ffffff" }}
              >
                Continue
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step Components ──────────────────────────────────────────────────── */

function TypeStep({
  selected,
  onSelect,
}: {
  selected: CommunityReportType | null;
  onSelect: (t: CommunityReportType) => void;
}) {
  return (
    <div>
      <p className="text-sm mb-3" style={{ color: "var(--rp-text-muted)" }}>
        What are you reporting?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {REPORT_TYPES.map((type) => {
          const isSelected = selected === type;
          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="flex flex-col items-start gap-1 rounded-xl p-3 text-left transition-colors"
              style={{
                minHeight: "80px",
                backgroundColor: isSelected
                  ? "color-mix(in srgb, var(--rp-info) 15%, transparent)"
                  : "var(--rp-surface-2)",
                border: `1px solid ${isSelected ? "var(--rp-info)" : "var(--rp-border)"}`,
                color: isSelected ? "var(--rp-info)" : "var(--rp-text)",
              }}
              aria-pressed={isSelected}
            >
              <span className="text-xl" aria-hidden="true">
                {REPORT_TYPE_LABELS[type].split(" ")[0]}
              </span>
              <span className="text-xs font-semibold leading-tight">
                {REPORT_TYPE_SHORT[type]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LocationStep({
  lat,
  lng,
  locationDescription,
  routeName,
  locating,
  locError,
  onDetect,
  onDescriptionChange,
  onRouteNameChange,
}: {
  lat: number | null;
  lng: number | null;
  locationDescription: string;
  routeName: string;
  locating: boolean;
  locError: string | null;
  onDetect: () => void;
  onDescriptionChange: (v: string) => void;
  onRouteNameChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm mb-1 font-medium" style={{ color: "var(--rp-text)" }}>
          Your location <span style={{ color: "var(--rp-critical)" }}>*</span>
        </p>
        <button
          onClick={onDetect}
          disabled={locating}
          className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-60"
          style={{
            backgroundColor: lat !== null
              ? "color-mix(in srgb, var(--rp-clear) 12%, transparent)"
              : "var(--rp-surface-2)",
            border: `1px solid ${lat !== null ? "var(--rp-clear)" : "var(--rp-border)"}`,
            color: lat !== null ? "var(--rp-clear)" : "var(--rp-text)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12" />
          </svg>
          {locating
            ? "Detecting location…"
            : lat !== null
            ? `📍 ${lat.toFixed(4)}, ${lng?.toFixed(4)} — tap to update`
            : "Use my current location"}
        </button>
        {locError && (
          <p className="text-xs mt-1.5" style={{ color: "var(--rp-critical)" }}>{locError}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium block mb-1" style={{ color: "var(--rp-text)" }}>
          Location description <span style={{ color: "var(--rp-text-muted)" }}>(optional)</span>
        </label>
        <textarea
          value={locationDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="e.g. Near mile marker 42, Exit 18 eastbound"
          rows={2}
          className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
          style={{
            backgroundColor: "var(--rp-surface-2)",
            border: "1px solid var(--rp-border)",
            color: "var(--rp-text)",
            outline: "none",
          }}
        />
      </div>

      <div>
        <label className="text-sm font-medium block mb-1" style={{ color: "var(--rp-text)" }}>
          Route / Road name <span style={{ color: "var(--rp-text-muted)" }}>(optional)</span>
        </label>
        <input
          type="text"
          value={routeName}
          onChange={(e) => onRouteNameChange(e.target.value)}
          placeholder="e.g. I-80, US-40, SR-99"
          className="w-full rounded-xl px-3 py-2.5 text-sm"
          style={{
            backgroundColor: "var(--rp-surface-2)",
            border: "1px solid var(--rp-border)",
            color: "var(--rp-text)",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

function DetailsStep({
  title,
  description,
  severity,
  onTitleChange,
  onDescriptionChange,
  onSeverityChange,
}: {
  title: string;
  description: string;
  severity: "INFO" | "ADVISORY" | "WARNING";
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSeverityChange: (v: "INFO" | "ADVISORY" | "WARNING") => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium block mb-1" style={{ color: "var(--rp-text)" }}>
          Title <span style={{ color: "var(--rp-critical)" }}>*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Brief description of the condition"
          maxLength={120}
          className="w-full rounded-xl px-3 py-2.5 text-sm"
          style={{
            backgroundColor: "var(--rp-surface-2)",
            border: "1px solid var(--rp-border)",
            color: "var(--rp-text)",
            outline: "none",
          }}
        />
        <p className="text-xs mt-1 text-right" style={{ color: "var(--rp-text-muted)" }}>
          {title.length}/120
        </p>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1" style={{ color: "var(--rp-text)" }}>
          Details <span style={{ color: "var(--rp-text-muted)" }}>(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Additional information for other drivers…"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
          style={{
            backgroundColor: "var(--rp-surface-2)",
            border: "1px solid var(--rp-border)",
            color: "var(--rp-text)",
            outline: "none",
          }}
        />
      </div>

      <div>
        <p className="text-sm font-medium mb-2" style={{ color: "var(--rp-text)" }}>
          Severity
        </p>
        <div className="flex gap-2">
          {SEVERITY_OPTIONS.map(({ value, label, color }) => {
            const isActive = severity === value;
            return (
              <button
                key={value}
                onClick={() => onSeverityChange(value)}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: isActive ? `${color}22` : "var(--rp-surface-2)",
                  border: `1px solid ${isActive ? color : "var(--rp-border)"}`,
                  color: isActive ? color : "var(--rp-text-muted)",
                  minHeight: "44px",
                }}
                aria-pressed={isActive}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({ form, error }: { form: FormState; error: string | null }) {
  const severityColor =
    form.severity === "WARNING" ? "#ff8c00" :
    form.severity === "ADVISORY" ? "#ffd000" : "#4096ff";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: "var(--rp-text-muted)" }}>
        Review your report before submitting.
      </p>

      <div
        className="rounded-xl p-3 flex flex-col gap-2"
        style={{
          backgroundColor: "var(--rp-surface-2)",
          border: "1px solid var(--rp-border)",
          borderLeft: `3px solid ${severityColor}`,
        }}
      >
        {/* Type + Severity */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${severityColor}20`,
              color: severityColor,
              border: `1px solid ${severityColor}40`,
            }}
          >
            {form.type ? REPORT_TYPE_SHORT[form.type] : "—"}
          </span>
          <span className="text-xs" style={{ color: "var(--rp-text-muted)" }}>
            {form.severity === "WARNING" ? "High" : form.severity === "ADVISORY" ? "Medium" : "Low"} severity
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-semibold" style={{ color: "var(--rp-text)" }}>
          {form.title || "—"}
        </p>

        {/* Description */}
        {form.description && (
          <p className="text-xs" style={{ color: "var(--rp-text-muted)" }}>
            {form.description}
          </p>
        )}

        {/* Location */}
        <div className="text-xs flex flex-col gap-0.5" style={{ color: "var(--rp-text-muted)" }}>
          {form.lat !== null && (
            <span>📍 {form.lat.toFixed(5)}, {form.lng?.toFixed(5)}</span>
          )}
          {form.locationDescription && <span>{form.locationDescription}</span>}
          {form.routeName && <span>Route: {form.routeName}</span>}
        </div>
      </div>

      {error && (
        <p
          className="text-xs rounded-xl px-3 py-2.5"
          style={{
            backgroundColor: "color-mix(in srgb, var(--rp-critical) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--rp-critical) 30%, transparent)",
            color: "var(--rp-critical)",
          }}
        >
          {error}
        </p>
      )}

      <p className="text-xs text-center" style={{ color: "var(--rp-text-muted)" }}>
        Reports are visible to all drivers in the area. They expire automatically after a few hours.
      </p>
    </div>
  );
}
