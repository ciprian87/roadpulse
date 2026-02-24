"use client";

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useRouteStore } from "@/stores/route-store";
import type { GeocodingSuggestion } from "@/lib/types/route";

const DARK = {
  bg: "#111118",
  input: "#1a1a24",
  border: "#2a2a38",
  heading: "#f0f0f5",
  body: "#c0c0d0",
  label: "#6a6a8a",
  suggestion: "#1a1a24",
  suggestionHover: "#22222e",
  error: "#ff4d4f",
};

const LIGHT = {
  bg: "#ffffff",
  input: "#f4f4f8",
  border: "#dcdce8",
  heading: "#0f0f1a",
  body: "#2e2e42",
  label: "#7070a0",
  suggestion: "#f4f4f8",
  suggestionHover: "#eaeaf2",
  error: "#cf1322",
};

type Theme = typeof DARK;

// ── AddressInput ──────────────────────────────────────────────────────────────

interface AddressInputProps {
  id: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  t: Theme;
  leadingIcon: ReactNode;
  onChange: (value: string) => void;
  onSelectSuggestion: (s: GeocodingSuggestion) => void;
  /** Called when Enter is pressed and the dropdown is closed — used to submit */
  onSubmit?: () => void;
}

function AddressInput({
  id,
  value,
  placeholder,
  disabled,
  t,
  leadingIcon,
  onChange,
  onSelectSuggestion,
  onSubmit,
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const listId = `${id}-list`;
  const isOpen = focused && suggestions.length > 0;

  // Scroll the highlighted item into view when navigating by keyboard
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/route/geocode?q=${encodeURIComponent(text)}`);
      if (res.ok) {
        const data = (await res.json()) as GeocodingSuggestion[];
        setSuggestions(data);
      }
    } catch {
      // Non-fatal — suggestions are optional
    }
  }, []);

  function handleChange(text: string) {
    onChange(text);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchSuggestions(text), 300);
  }

  function commit(s: GeocodingSuggestion) {
    onSelectSuggestion(s);
    setSuggestions([]);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        if (!isOpen) return;
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        break;

      case "ArrowUp":
        if (!isOpen) return;
        e.preventDefault();
        // -1 means "no item selected, cursor back in the input"
        setActiveIndex((i) => Math.max(i - 1, -1));
        break;

      case "Enter":
        if (isOpen && activeIndex >= 0) {
          // Confirm the highlighted suggestion
          e.preventDefault();
          commit(suggestions[activeIndex]!);
        } else if (isOpen) {
          // Dismiss dropdown without selecting; let the user keep typing
          e.preventDefault();
          setSuggestions([]);
          setActiveIndex(-1);
        } else {
          // Dropdown closed — bubble up to trigger route check
          onSubmit?.();
        }
        break;

      case "Escape":
        setSuggestions([]);
        setActiveIndex(-1);
        break;
    }
  }

  return (
    <div className="relative">
      <div
        className="flex items-center rounded-lg overflow-hidden"
        style={{ backgroundColor: t.input, border: `1px solid ${t.border}` }}
      >
        {leadingIcon}
        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          aria-activedescendant={
            isOpen && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
          }
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
          className="flex-1 bg-transparent text-sm outline-none py-2.5 pr-3"
          style={{ color: t.heading }}
        />
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden z-50 shadow-lg max-h-[240px] overflow-y-auto"
          style={{ backgroundColor: t.suggestion, border: `1px solid ${t.border}` }}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className="px-3 py-2.5 text-sm cursor-pointer"
              style={{
                color: t.body,
                backgroundColor: i === activeIndex ? t.suggestionHover : "transparent",
              }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                // Prevent the input from losing focus before we register the click
                e.preventDefault();
                commit(s);
              }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── RouteInput ────────────────────────────────────────────────────────────────

interface RouteInputProps {
  darkMode: boolean;
}

const ACTIVE_STATUSES = new Set(["geocoding", "routing", "checking"]);

export function RouteInput({ darkMode }: RouteInputProps) {
  const t = darkMode ? DARK : LIGHT;

  const originText = useRouteStore((s) => s.originText);
  const destinationText = useRouteStore((s) => s.destinationText);
  const status = useRouteStore((s) => s.status);
  const errorMessage = useRouteStore((s) => s.errorMessage);
  const setOriginText = useRouteStore((s) => s.setOriginText);
  const setDestinationText = useRouteStore((s) => s.setDestinationText);
  const setOriginCoords = useRouteStore((s) => s.setOriginCoords);
  const setDestinationCoords = useRouteStore((s) => s.setDestinationCoords);
  const swapPoints = useRouteStore((s) => s.swapPoints);
  const clearRoute = useRouteStore((s) => s.clearRoute);
  const checkRoute = useRouteStore((s) => s.checkRoute);

  const isActive = ACTIVE_STATUSES.has(status);
  const canSubmit = !isActive && !!originText && !!destinationText;

  function handleSelectOrigin(s: GeocodingSuggestion) {
    setOriginText(s.label);
    setOriginCoords(s.lat, s.lng);
  }

  function handleSelectDest(s: GeocodingSuggestion) {
    setDestinationText(s.label);
    setDestinationCoords(s.lat, s.lng);
  }

  function handleOriginChange(value: string) {
    setOriginText(value);
    // Clear previously resolved coords so the server re-geocodes the new text
    setOriginCoords(0, 0);
  }

  function handleDestChange(value: string) {
    setDestinationText(value);
    setDestinationCoords(0, 0);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const label = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      setOriginText(label);
      setOriginCoords(coords.latitude, coords.longitude);
    });
  }

  const statusLabel: Record<string, string> = {
    geocoding: "Geocoding…",
    routing: "Fetching route…",
    checking: "Checking hazards…",
  };

  const locationIcon = (
    <button
      onClick={useMyLocation}
      tabIndex={-1}
      className="flex-none flex items-center justify-center transition-opacity hover:opacity-70"
      style={{ width: "40px", height: "44px", color: "#4096ff" }}
      title="Use my location"
      aria-label="Use my location as origin"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </button>
  );

  const pinIcon = (
    <span
      className="flex-none flex items-center justify-center"
      style={{ width: "40px", height: "44px", color: t.label }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
      </svg>
    </span>
  );

  return (
    <div className="space-y-2 p-3">
      {/* Origin */}
      <AddressInput
        id="route-origin"
        value={originText}
        placeholder="Origin"
        disabled={isActive}
        t={t}
        leadingIcon={locationIcon}
        onChange={handleOriginChange}
        onSelectSuggestion={handleSelectOrigin}
        onSubmit={canSubmit ? () => void checkRoute() : undefined}
      />

      {/* Swap + destination row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            swapPoints();
            clearRoute();
          }}
          className="flex-none flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
          style={{
            width: "32px",
            height: "32px",
            color: t.label,
            backgroundColor: t.input,
            border: `1px solid ${t.border}`,
          }}
          title="Swap origin and destination"
          aria-label="Swap origin and destination"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>

        <div className="flex-1">
          <AddressInput
            id="route-dest"
            value={destinationText}
            placeholder="Destination"
            disabled={isActive}
            t={t}
            leadingIcon={pinIcon}
            onChange={handleDestChange}
            onSelectSuggestion={handleSelectDest}
            onSubmit={canSubmit ? () => void checkRoute() : undefined}
          />
        </div>
      </div>

      {/* Check Route button */}
      <button
        onClick={() => void checkRoute()}
        disabled={!canSubmit}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity"
        style={{
          backgroundColor: "#4096ff",
          color: "#ffffff",
          opacity: canSubmit ? 1 : 0.5,
          cursor: canSubmit ? "pointer" : "not-allowed",
          minHeight: "44px",
        }}
      >
        {isActive ? (statusLabel[status] ?? "Checking…") : "Check Route"}
      </button>

      {/* Error message */}
      {status === "error" && errorMessage && (
        <p className="text-xs text-center px-1" style={{ color: t.error }}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
